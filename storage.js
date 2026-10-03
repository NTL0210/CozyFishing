// storage.js — Pure IndexedDB wrapper for Cozy Fishing save data
// No external libraries. Exposes a simple async API over a single
// object store so the rest of the game never touches raw IDB calls.

const DB_NAME = 'CozyFishing';
const DB_VERSION = 1;
const STORE_NAME = 'playerData';
const SAVE_KEY = 'save';

// ---------------------------------------------------------------------------
// Default game state (matches the schema spec)
// ---------------------------------------------------------------------------
const DEFAULT_STATE = {
  coins: 0,
  currentBait: null,
  unlockedBaits: [],
  currentRod: 'basic',
  unlockedRods: ['basic'],
  currentZone: 'village_pond',
  unlockedZones: ['village_pond'],
  fishDex: {},
  crabPots: { placeTime: 0, loot: [] },
  questDate: null, // tracks which day quests were generated for
  quests: [],
  lastSaveTime: null, // populated on exit; used for offline idle (Phase 5)
};

let dbPromise = null;

// ---------------------------------------------------------------------------
// Low-level: open (or create) the database + object store
// ---------------------------------------------------------------------------
function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });

  return dbPromise;
}

// ---------------------------------------------------------------------------
// High-level API
// ---------------------------------------------------------------------------

// Initialize: open the DB, create a default save if none exists.
// Returns the current game state.
async function initStorage() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(SAVE_KEY);

    getRequest.onsuccess = () => {
      if (getRequest.result) {
        resolve(getRequest.result);
      } else {
        // First-time player: seed with defaults.
        createDefaultSave(database).then(resolve).catch(reject);
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

function createDefaultSave(database) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id: SAVE_KEY, ...DEFAULT_STATE });
    tx.oncomplete = () => resolve({ ...DEFAULT_STATE });
    tx.onerror = () => reject(tx.error);
  });
}

// Persist the full game state.
async function saveGameState(state) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id: SAVE_KEY, ...state });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Load the full game state (does NOT create a default if missing).
async function loadGameState() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(SAVE_KEY);
    request.onsuccess = () => resolve(request.result || { ...DEFAULT_STATE });
    request.onerror = () => reject(request.error);
  });
}

// Merge partial updates into the existing state, then save.
async function updateGameState(updates) {
  const state = await loadGameState();
  const newState = { ...state, ...updates };
  await saveGameState(newState);
  return newState;
}

// Record the exit timestamp (for offline crab-pot idle — Phase 5).
function markLastSave() {
  // Fire-and-forget: best-effort on unload.
  updateGameState({ lastSaveTime: Date.now() });
}

export {
  DEFAULT_STATE,
  initStorage,
  loadGameState,
  saveGameState,
  updateGameState,
  markLastSave,
};
