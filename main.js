// Cozy Fishing — Entry point
// Phase 1: scaffold
// Phase 2: storage init + status bar render
// Phase 3: FishingGame state machine + tension bar + RNG
// Phase 4: day/night, weather, bait modifier, fish-dex entries
// Phase 5: offline crab-pot idle, daily quests, zone switching

import { initStorage, saveGameState } from './storage.js';
import {
  FishingGame,
  STATE,
  RARITY,
  RARITY_RANK,
  BAITS,
  RODS,
  ZONES,
  WEATHER_TYPES,
  generateCrabPotLoot,
  generateDailyQuests,
} from './game.js';

// References
let gameState = null;
let game = null;

// Global error handlers — makes debugging visible in browser console
window.addEventListener('error', (e) => console.error('[Cozy Fishing] Global error:', e.error?.message || e.error));
window.addEventListener('unhandledrejection', (e) => console.error('[Cozy Fishing] Unhandled rejection:', e.reason?.message || e.reason));

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
async function init() {
  console.log('[Cozy Fishing] Init started');
  gameState = await initStorage();
  console.log('[Cozy Fishing] Storage loaded:', { coins: gameState.coins, quests: gameState.quests?.length, questDate: gameState.questDate });

  // --- Phase 5: Offline crab-pot progress ---
  const { lootCount } = calcOfflineProgress(gameState);

  // --- Phase 5: Daily quests (regenerate if it's a new day) ---
  const newQuests = checkDailyQuests(gameState);

  // Save the updated state (offline loot + possibly new quests)
  await saveGameState(gameState);

  console.log('[Cozy Fishing] Rendering UI...');
  renderStatusBar();
  renderCrabPot();
  populateQuests();
  console.log('[Cozy Fishing] UI populated — quest count:', gameState.quests?.length);

  // --- Initialize the fishing game ---
  const canvas = document.getElementById('game-canvas');
  game = new FishingGame(canvas, gameState, {
    onCatch: (updatedState, catchInfo) => {
      gameState = updatedState;
      trackQuestProgress(catchInfo);
      renderStatusBar();
      populateQuests();
      saveGameState(updatedState);
    },
    onStateChange: (fsm) => {
      const castBtn = document.getElementById('cast-btn');
      if (castBtn) castBtn.disabled = fsm !== STATE.IDLE;
    },
  });
  game.start();

  // Mirror day/night + weather to <body> for CSS styling
  document.body.classList.add(`time-${game.timeOfDay}`);
  if (game.weather === 'rain') document.body.classList.add('weather-rain');

  // Cast button
  document.getElementById('cast-btn').addEventListener('click', () => game.cast());

  // Crab pot collect
  document.getElementById('collect-btn').addEventListener('click', () => collectCrabPot());

  // Modal triggers
  document.getElementById('shop-btn').addEventListener('click', () => {
    populateShop();
    toggleModal('shop-modal', true);
  });
  document.getElementById('dex-btn').addEventListener('click', () => {
    populateFishDex();
    toggleModal('dex-modal', true);
  });

  // Close buttons
  document.querySelectorAll('.modal .close-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) toggleModal(modal.id, false);
    });
  });

  // Shop event delegation (bait / rod / zone purchases)
  document.getElementById('shop-modal').addEventListener('click', async (e) => {
    const target = e.target;
    if (target.classList.contains('buy-btn'))      await buyBait(target.dataset.bait);
    else if (target.classList.contains('select-btn')) await selectBait(target.dataset.bait);
    else if (target.classList.contains('buy-rod-btn'))  await buyRod(target.dataset.rod);
    else if (target.classList.contains('buy-zone-btn')) await unlockZone(target.dataset.zone);
    else if (target.classList.contains('switch-btn'))   await switchZone(target.dataset.zone);
  });

  // Notifications for offline loot / new quests
  setTimeout(() => {
    if (lootCount > 0) {
      showNotification(`Bẫy cua đã thu thập ${lootCount} món trong khi bạn offline!`);
    }
    if (newQuests) {
      showNotification('Nhiệm vụ mới đã được phát hành!');
    }
  }, 600);

  // Pre-populate shop so players see items immediately (no "Đang tải...")
  populateShop();
  console.log('[Cozy Fishing] Game ready:', { timeOfDay: game.timeOfDay, weather: game.weather, zone: gameState.currentZone });

  // Periodic save for accurate offline timestamp
  setInterval(() => {
    gameState.lastSaveTime = Date.now();
    saveGameState(gameState);
  }, 30000);

  // Save exit timestamp (best-effort)
  window.addEventListener('pagehide', () => {
    gameState.lastSaveTime = Date.now();
    saveGameState(gameState);
  });
}

// ---------------------------------------------------------------------------
// Offline crab-pot progress
// ---------------------------------------------------------------------------
function calcOfflineProgress(state) {
  if (!state.lastSaveTime) return { lootCount: 0 };

  const elapsedMs = Date.now() - state.lastSaveTime;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const lootCount = Math.min(Math.floor(elapsedMinutes / 30), 50); // cap at 50

  if (lootCount > 0) {
    for (let i = 0; i < lootCount; i++) {
      state.crabPots.loot.push(generateCrabPotLoot());
    }
    state.crabPots.placeTime = Date.now();
  }

  state.lastSaveTime = null;
  return { lootCount };
}

// ---------------------------------------------------------------------------
// Daily quests
// ---------------------------------------------------------------------------
function checkDailyQuests(state) {
  const today = new Date().toDateString();
  if (state.questDate !== today) {
    state.quests = generateDailyQuests();
    state.questDate = today;
    return true;
  }
  return false;
}

function populateQuests() {
  const list = document.getElementById('quest-list');
  if (!gameState.quests || gameState.quests.length === 0) return;

  list.innerHTML = '';
  gameState.quests.forEach((quest) => {
    const div = document.createElement('div');
    div.className = `quest-item ${quest.completed ? 'completed' : ''}`;
    const progress = Math.min(quest.current, quest.target);
    const pct = (progress / quest.target) * 100;

    div.innerHTML = `
      <div class="quest-header">
        <span class="quest-desc">${quest.desc}</span>
        <span class="quest-reward">💰 ${quest.reward}</span>
      </div>
      <div class="quest-bar">
        <div class="quest-fill" style="width:${pct}%"></div>
      </div>
      <div class="quest-progress">${progress}/${quest.target}</div>
    `;
    list.appendChild(div);
  });
}

// Called after each catch to update quest progress
function trackQuestProgress(catchInfo) {
  const completed = [];
  gameState.quests.forEach((quest) => {
    if (quest.completed) return;

    let inc = 0;
    if (quest.type === 'catch')      inc = 1;
    else if (quest.type === 'trash' && catchInfo.isTrash)      inc = 1;
    else if (quest.type === 'rare' && RARITY_RANK[catchInfo.rarity] >= 3)    inc = 1;
    else if (quest.type === 'uncommon' && RARITY_RANK[catchInfo.rarity] >= 2) inc = 1;
    else if (quest.type === 'earn')  inc = catchInfo.value;

    if (inc > 0) {
      quest.current += inc;
      if (quest.current >= quest.target && !quest.completed) {
        quest.completed = true;
        gameState.coins += quest.reward;
        completed.push(quest);
      }
    }
  });

  if (completed.length > 0) {
    const total = completed.reduce((s, q) => s + q.reward, 0);
    showNotification(`Hoàn thành ${completed.length} nhiệm vụ! +${total} vàng`);
  }
  populateQuests();
}

// ---------------------------------------------------------------------------
// Crab pot UI + collection
// ---------------------------------------------------------------------------
function renderCrabPot() {
  const count = gameState.crabPots?.loot?.length || 0;
  const el = document.getElementById('crab-pot-count');
  if (el) el.textContent = `${count} món`;
  const btn = document.getElementById('collect-btn');
  if (btn) btn.disabled = count === 0;
}

async function collectCrabPot() {
  const loot = gameState.crabPots.loot;
  if (!loot.length) return;

  let totalCoins = 0;
  const baitUnlocked = [];

  loot.forEach((item) => {
    if (item.coinRange) {
      const [min, max] = item.coinRange;
      totalCoins += Math.floor(Math.random() * (max - min + 1)) + min;
    } else if (item.coinValue) {
      totalCoins += item.coinValue;
    } else if (item.baitId && !gameState.unlockedBaits.includes(item.baitId)) {
      gameState.unlockedBaits.push(item.baitId);
      baitUnlocked.push(item.baitId);
    }
  });

  gameState.coins += totalCoins;
  gameState.crabPots.loot = [];
  gameState.crabPots.placeTime = Date.now();

  await saveGameState(gameState);
  renderStatusBar();
  renderCrabPot();

  let msg = `Thu thập ${totalCoins} vàng từ bẫy!`;
  if (baitUnlocked.length) {
    msg += ` Mồi: ${baitUnlocked.map((b) => BAITS[b]?.name ?? b).join(', ')}`;
  }
  showNotification(msg);
}

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------
function renderStatusBar() {
  setElement('coins', String(gameState.coins || 0));
  setElement('bait', BAITS[gameState.currentBait]?.name ?? '—');
  setElement('zone', ZONES[gameState.currentZone]?.name ?? '???');

  if (game) {
    const dayLabel = game.timeOfDay === 'night' ? '🌙 Đêm' : '☀️ Ngày';
    const w = game.weather;
    const wData = WEATHER_TYPES[w] || WEATHER_TYPES.clear;
    setElement('weather', `${dayLabel} · ${wData.icon} ${wData.name}`);
  }
}

function setElement(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ---------------------------------------------------------------------------
// Shop logic
// ---------------------------------------------------------------------------
function populateShop() {
  // Rod upgrade
  const rodDiv = document.getElementById('rod-upgrade');
  if (rodDiv) {
    const currentRod = gameState.currentRod;
    const rodKeys = Object.keys(RODS);
    const curIdx = rodKeys.indexOf(currentRod);
    const nextRod = rodKeys[curIdx + 1];

    if (nextRod) {
      const rod = RODS[nextRod];
      const affordable = gameState.coins >= rod.price;
      rodDiv.innerHTML = `
        <div class="rod-card">
          <div class="rod-name">${rod.name} (Lv.${rod.level})</div>
          <div class="rod-price">💰 ${rod.price}</div>
          <div class="rod-desc">Tăng vùng giữ cá +${rod.gripBonus}px</div>
          <button class="buy-rod-btn" data-rod="${nextRod}" ${affordable ? '' : 'disabled'}>Nâng cấp</button>
        </div>
      `;
    } else {
      const rod = RODS[currentRod];
      rodDiv.innerHTML = `
        <div class="rod-card max">
          <div class="rod-name">${rod.name} (MAX)</div>
          <span class="max-label">✓</span>
        </div>
      `;
    }
  }

  // Bait grid
  const baitGrid = document.getElementById('bait-grid');
  if (baitGrid) {
    baitGrid.innerHTML = '';
    Object.entries(BAITS).forEach(([key, bait]) => {
      if (key === 'none') return;
      const unlocked = gameState.unlockedBaits.includes(key);
      const affordable = gameState.coins >= bait.price;
      const isCurrent = gameState.currentBait === key;
      const modText = bait.weightMod
        ? 'Tăng: ' + Object.entries(bait.weightMod).map(([r]) => RARITY[r]?.name).join(', ')
        : 'Mặc định';

      const div = document.createElement('div');
      div.className = `bait-item ${unlocked ? 'unlocked' : ''} ${isCurrent ? 'bait-current' : ''}`;

      if (unlocked) {
        div.innerHTML = `
          <div class="bait-name">${bait.name}</div>
          <div class="bait-price">💰 ${bait.price}</div>
          <div class="bait-mod">${modText}</div>
          <button class="select-btn" data-bait="${key}">${isCurrent ? 'Đang dùng' : 'Chọn'}</button>
        `;
      } else {
        div.innerHTML = `
          <div class="bait-name">${bait.name}</div>
          <div class="bait-price">💰 ${bait.price}</div>
          <div class="bait-mod">${modText}</div>
          <button class="buy-btn" data-bait="${key}" ${affordable ? '' : 'disabled'}>Mua</button>
        `;
      }
      baitGrid.appendChild(div);
    });
  }

  // Zone grid
  const zoneGrid = document.getElementById('zone-grid');
  if (zoneGrid) {
    zoneGrid.innerHTML = '';
    Object.entries(ZONES).forEach(([key, zone]) => {
      const unlocked = gameState.unlockedZones.includes(key);
      const affordable = gameState.coins >= zone.buyPrice;
      const isCurrent = gameState.currentZone === key;
      const div = document.createElement('div');
      div.className = `zone-item ${unlocked ? 'unlocked' : ''} ${affordable && !unlocked ? 'affordable' : ''} ${isCurrent ? 'current' : ''}`;

      let button = '';
      if (!unlocked) {
        button = `<button class="buy-zone-btn" data-zone="${key}" ${affordable ? '' : 'disabled'}>Mua</button>`;
      } else if (!isCurrent) {
        button = `<button class="switch-btn" data-zone="${key}">Đổi</button>`;
      }

      div.innerHTML = `
        <span class="zone-icon">${zone.icon}</span>
        <span class="zone-name">${zone.name}</span>
        ${button}
        ${isCurrent ? '<span class="zone-current">Hiện tại</span>' : ''}
      `;
      zoneGrid.appendChild(div);
    });
  }
}

async function buyBait(key) {
  const bait = BAITS[key];
  if (!bait || gameState.coins < bait.price || gameState.unlockedBaits.includes(key)) return;
  gameState.coins -= bait.price;
  gameState.unlockedBaits.push(key);
  gameState.currentBait = key;
  await saveGameState(gameState);
  renderStatusBar();
  populateShop();
  showNotification(`Mua ${bait.name}!`);
}

async function selectBait(key) {
  gameState.currentBait = key;
  await saveGameState(gameState);
  renderStatusBar();
  populateShop();
}

async function buyRod(key) {
  const rod = RODS[key];
  if (!rod || rod.price > gameState.coins || gameState.unlockedRods.includes(key)) return;
  gameState.coins -= rod.price;
  gameState.currentRod = key;
  gameState.unlockedRods.push(key);
  if (game) game.refreshEnvironment();
  await saveGameState(gameState);
  renderStatusBar();
  populateShop();
  showNotification(`Nâng cấp: ${rod.name}!`);
}

async function unlockZone(key) {
  const zone = ZONES[key];
  if (!zone || gameState.coins < zone.buyPrice || gameState.unlockedZones.includes(key)) return;
  gameState.coins -= zone.buyPrice;
  gameState.unlockedZones.push(key);
  gameState.currentZone = key;
  if (game) game.refreshEnvironment();
  await saveGameState(gameState);
  renderStatusBar();
  populateShop();
  showNotification(`Đã mở khóa: ${zone.name}!`);
}

async function switchZone(key) {
  if (!gameState.unlockedZones.includes(key)) return;
  gameState.currentZone = key;
  if (game) game.refreshEnvironment();
  await saveGameState(gameState);
  renderStatusBar();
  populateShop();
  showNotification(`Chuyển đến: ${ZONES[key].name}!`);
}

// ---------------------------------------------------------------------------
// Fish-dex grid
// ---------------------------------------------------------------------------
function populateFishDex() {
  const grid = document.getElementById('fish-grid');
  const dex = gameState.fishDex || {};
  const keys = Object.keys(dex);

  if (keys.length === 0) {
    grid.innerHTML = '<p class="empty-dex">Chưa có cá nào... hãy câu thử!</p>';
    return;
  }

  grid.innerHTML = '';
  keys.forEach((id) => {
    const entry = dex[id];
    const rarity = RARITY[entry.rarity] || RARITY.common;
    const card = document.createElement('div');
    card.className = 'fish-card';
    card.innerHTML = `
      <div class="fish-image" style="background:${rarity.color}"></div>
      <div class="fish-name">${entry.name}</div>
      <div class="fish-rarity" style="color:${rarity.color}">${rarity.name}</div>
      <div class="fish-count">Số lượng: ${entry.count} | Kỷ lục: ${entry.record}</div>
      <div class="fish-desc">${entry.desc}</div>
    `;
    grid.appendChild(card);
  });
}

// ---------------------------------------------------------------------------
// Modal toggle
// ---------------------------------------------------------------------------
function toggleModal(id, show) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.toggle('active', show);
}

// ---------------------------------------------------------------------------
// Toast notification
// ---------------------------------------------------------------------------
function showNotification(text) {
  let notif = document.getElementById('notification');
  if (!notif) {
    notif = document.createElement('div');
    notif.id = 'notification';
    document.body.appendChild(notif);
  }
  notif.textContent = text;
  notif.classList.add('show');
  clearTimeout(notif._hideTimer);
  notif._hideTimer = setTimeout(() => notif.classList.remove('show'), 3000);
}

// Start everything (with error handling)
init().catch((err) => {
  console.error('[Cozy Fishing] Init failed:', err);
  const el = document.getElementById('quest-list');
  if (el) el.innerHTML = '<p style="color:red">Lỗi khởi tạo: ' + (err.message || 'unknown') + '</p>';
});
