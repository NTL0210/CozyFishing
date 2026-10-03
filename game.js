// game.js — Core game loop, 4-state fishing machine, tension-bar minigame, RNG loot, environment, loot tables

// ==================== CONFIGURATION ====================
const CONFIG = {
  // WAITING phase: random time before a bite (ms)
  BITE_MIN: 1200,
  BITE_MAX: 5500,

  // Tension-bar minigame
  TENSION_FILL_RATE:   60, // %/s while fish in grip + mouse held
  TENSION_DRAIN_RATE:  35, // %/s otherwise
  GRIP_WIDTH_HELD:     100,
  GRIP_WIDTH_RELEASED:  30,

  // Offline crab-pot idle
  CRAB_POT_INTERVAL: 30, // minutes per loot cycle
};

// ==================== RARITY ====================
const RARITY = {
  common:   { name: 'Thường',     color: '#8BB3AA', weight: 55, speed: 1.0 },
  uncommon: { name: 'Thường +',   color: '#90C36A', weight: 28, speed: 1.6 },
  rare:     { name: 'Hiếm',       color: '#4ECDC4', weight: 14, speed: 2.4 },
  epic:     { name: 'S rời',      color: '#C78CFF', weight:  3, speed: 3.6 },
};

const RARITY_RANK = { common: 1, uncommon: 2, rare: 3, epic: 4 };

// ==================== BAIT SYSTEM ====================
// weightMod adjusts rarity chance in the RNG loot table (Phase 4)
const BAITS = {
  none:     { name: 'Không mồi',      price: 0,   weightMod: {} },
  worm:     { name: 'Sâu đất',        price: 10,  weightMod: { common: 2.0 } },                         // ăn nhiều cá thường
  cricket:  { name: 'Châu chó',       price: 20,  weightMod: { uncommon: 1.8 } },                          // cá không phổ biến hơn
  spinner:  { name: 'Mồi quay bạc',   price: 50,  weightMod: { rare: 2.5 } },                              // cá hiếm hơn
  glowworm: { name: 'Sâu phát sáng',  price: 100, weightMod: { rare: 1.8, epic: 3.0 } },                    // cá hiếm + s rời
};

// ==================== FISHING RODS ====================
// gripBonus widens the tension-bar grip zone
const RODS = {
  basic:      { name: 'Cần câu gỗ',         price: 0,   gripBonus: 0,  level: 1 },
  bamboo:     { name: 'Cần câu tre',        price: 100, gripBonus: 15, level: 2 },
  fiberglass: { name: 'Cần câu thủy tinh',    price: 300, gripBonus: 25, level: 3 },
};

// ==================== ZONES ====================
// Each zone: name, buyPrice, icon, water colors for day/night
const ZONES = {
  village_pond: {
    name: 'Ao Làng',
    buyPrice: 0,
    icon: '🏠',
    waterDay: '#A8DADC', waterNight: '#3A6474',
    waterDayDark: '#7FB7A5', waterNightDark: '#2C5364',
  },
  misty_lake: {
    name: 'Hồ Sương Mờ',
    buyPrice: 200,
    icon: '🌫️',
    waterDay: '#B8C5D4', waterNight: '#4A6B7A',
    waterDayDark: '#9AA8B8', waterNightDark: '#3A5B6A',
  },
};

// ==================== FISH / ZONE LOOT TABLES ====================
// Each fish: id, name, rarity, value (coins), optional isTrash, desc
const ZONE_FISH = {
  village_pond: [
    { id: 'koi',        name: 'Cá Koi',            rarity: 'common',   value: 10,  desc: 'Cá có vảy lấp lánh.' },
    { id: 'goldfish',   name: 'Cá Vàng',           rarity: 'common',   value: 15,  desc: 'Cá nhỏ tinh nghịch.' },
    { id: 'catfish',    name: 'Cá Mục',            rarity: 'uncommon', value: 30,  desc: 'Cá ăn mọi ở gầm tàu.' },
    { id: 'perch',      name: 'Cá Chép',           rarity: 'uncommon', value: 35,  desc: 'Cá đục cánh bờ ruộng.' },
    { id: 'koi_luxury', name: 'Cá Koi Hoàng Sang', rarity: 'rare',     value: 120, desc: 'Mỏm thẳm và xa sang.' },
    { id: 'trash',      name: 'Rác',               rarity: 'common',   value: 0,  isTrash: true, desc: 'Thải nhựa.' },
    { id: 'boot',       name: 'Dép',               rarity: 'common',   value: 1,  isTrash: true, desc: 'Dép cũ lặn xuống đáy.' },
  ],
  misty_lake: [
    { id: 'perch',      name: 'Cá Chép',           rarity: 'uncommon', value: 35,  desc: 'Cá đục cánh bờ ruộng.' },
    { id: 'carp',       name: 'Cá Dông',           rarity: 'rare',     value: 80,  desc: 'Cá lớn ở đáy hồ sâu.' },
    { id: 'mist_trout', name: 'Cá Sông Sương',     rarity: 'rare',     value: 100, desc: 'Cá sống trong sương mù dày.' },
    { id: 'koi_luxury', name: 'Cá Koi Hoàng Sang', rarity: 'rare',     value: 120, desc: 'Mỏm thẳm và xa sang.' },
    { id: 'trash',      name: 'Rác',               rarity: 'common',   value: 0,  isTrash: true, desc: 'Thải nhựa.' },
    { id: 'boot',       name: 'Dép',               rarity: 'common',   value: 1,  isTrash: true, desc: 'Dép cũ lặn xuống đáy.' },
  ],
};

// ==================== WEATHER ====================
// rain = slippery line (faster tension drain) + rare fish more common
const WEATHER_TYPES = {
  clear: { name: 'Nắng đẹp', icon: '☀️', tensionMod: 1.0, rareMod: 1.0 },
  rain:  { name: 'Mưa rơi',   icon: '🌧️', tensionMod: 1.4, rareMod: 1.5 },
};

function getTimeOfDay() {
  const hour = new Date().getHours();
  return (hour >= 6 && hour < 18) ? 'day' : 'night';
}

function getRandomWeather() {
  const keys = Object.keys(WEATHER_TYPES);
  return keys[Math.floor(Math.random() * keys.length)];
}

// ==================== CRAB POT LOOT (Phase 5) ====================
const CRAB_POT_LOOT_TABLE = [
  { id: 'coins_small', name: 'Xu nhỏ',       chance: 0.45, coinRange: [3, 8] },
  { id: 'bait_worm',   name: 'Sâu đất',      chance: 0.25, baitId: 'worm' },
  { id: 'bait_cricket',name: 'Châu chó',     chance: 0.15, baitId: 'cricket' },
  { id: 'junk_can',    name: 'Lon nhựa',     chance: 0.10, coinValue: 1, isTrash: true },
  { id: 'gear',        name: 'Bánh xe cơ khí', chance: 0.05, coinValue: 20 },
];

function generateCrabPotLoot() {
  let r = Math.random();
  let cumulative = 0;
  for (const item of CRAB_POT_LOOT_TABLE) {
    cumulative += item.chance;
    if (r <= cumulative) return { ...item };
  }
  return { ...CRAB_POT_LOOT_TABLE[0] };
}

// ==================== DAILY QUESTS (Phase 5) ====================
const QUEST_TEMPLATES = [
  { id: 'catch_3',        desc: 'Câu 3 cá',                target: 3,  type: 'catch',     reward: 15 },
  { id: 'catch_5',        desc: 'Câu 5 cá',                target: 5,  type: 'catch',     reward: 30 },
  { id: 'catch_trash',    desc: 'Bắt 1 mảnh rác',          target: 1,  type: 'trash',     reward: 10 },
  { id: 'catch_rare',     desc: 'Câu 1 cá hiếm',           target: 1,  type: 'rare',      reward: 50 },
  { id: 'catch_uncommon', desc: 'Câu 2 cá không phổ biến', target: 2,  type: 'uncommon',  reward: 40 },
  { id: 'earn_50',        desc: 'Kiếm 50 vàng',            target: 50, type: 'earn',      reward: 25 },
];

function generateDailyQuests() {
  const shuffled = [...QUEST_TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map(q => ({ ...q, current: 0, completed: false }));
}

// ==================== RNG LOOT TABLE ====================
// Accepts bait + environment (timeOfDay, weather) to modify rarity weights.
function rollLoot(zone, bait = 'none', env = {}) {
  const pool = ZONE_FISH[zone] || ZONE_FISH.village_pond;
  const isNight = env.timeOfDay === 'night';
  const weather = env.weather || 'clear';

  const items = pool.map(fish => {
    const rarity = RARITY[fish.rarity];
    let weight = rarity.weight;

    // Bait modifier (Phase 4)
    const baitDef = BAITS[bait];
    if (baitDef?.weightMod?.[fish.rarity]) {
      weight *= baitDef.weightMod[fish.rarity];
    }

    // Night: rare+ fish more common (non-trash)
    if (isNight && !fish.isTrash && rarity.speed >= 2.0) {
      weight *= 1.8;
    }

    // Weather: rain boosts rare fish (non-trash)
    if (weather === 'rain' && !fish.isTrash && rarity.speed >= 1.6) {
      weight *= WEATHER_TYPES.rain.rareMod;
    }

    return { ...fish, weight };
  });

  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let r = Math.random() * total;
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.weight;
    if (r <= cumulative) {
      const { weight, ...clean } = item;
      return clean;
    }
  }
  const { weight, ...clean } = items[0];
  return clean;
}

// ==================== STATE MACHINE ====================
const STATE = {
  IDLE:    0, // haven't cast the line
  WAITING: 1, // bobber in water, waiting for a bite
  REELING: 2, // tension-bar minigame active
  CAUGHT:  3, // fish landed, show success
};

// ==================== PALETTE (cozy pastel) ====================
const PALETTE = {
  bobber:     '#FF6B6B',
  bobberDark: '#E55A5A',
  wood:       '#A88379',
  gold:       '#FFD369',
  text:       '#5A4A42',
  panel:      '#FFF8F0',
  shadow:     'rgba(0,0,0,0.08)',
  star:       '#FFF9C4',
  rain:       'rgba(170,190,210,0.6)',
};

// ==================== FISHING GAME ====================
export class FishingGame {
  constructor(canvas, gameState, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gameState = gameState;
    this.onCatch = options.onCatch || (() => {});
    this.onStateChange = options.onStateChange || (() => {});

    // Environment (computed once per session)
    this.timeOfDay = getTimeOfDay();
    this.weather = getRandomWeather();

    // State machine
    this.fsm = STATE.IDLE;
    this.currentFish = null;
    this.waitTimerId = null;

    // Mouse tracking
    this.mouseX = canvas.width / 2;
    this.mouseDown = false;
    this.mouseOnCanvas = false;

    // Reeling internals
    this.tension = 0;
    this._fishPos = 0;
    this._caughtAnimStart = 0;
    this._lastTime = 0;

    this._bindEvents();
  }

  // ---- Getters (zone-aware) ----
  get _zone() { return ZONES[this.gameState.currentZone] || ZONES.village_pond; }
  get _waterColor()     { return this.timeOfDay === 'night' ? this._zone.waterNight     : this._zone.waterDay; }
  get _waterDarkColor() { return this.timeOfDay === 'night' ? this._zone.waterNightDark : this._zone.waterDayDark; }
  get _rod()            { return RODS[this.gameState.currentRod] || RODS.basic; }

  // ---- Canvas mouse events ----
  _bindEvents() {
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mouseenter', () => { this.mouseOnCanvas = true; });
    this.canvas.addEventListener('mouseleave', () => { this.mouseOnCanvas = false; });
    this.canvas.addEventListener('mousedown', () => { this._onMouseDown(); });
    this.canvas.addEventListener('mouseup',   () => { this._onMouseUp(); });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = this.canvas.width / rect.width;
    this.mouseX = (e.clientX - rect.left) * ratio;
  }

  _onMouseDown() { this.mouseDown = true; }
  _onMouseUp()   { this.mouseDown = false; }

  // ---- Public API ----

  // IDLE -> WAITING (called by cast button)
  cast() {
    if (this.fsm !== STATE.IDLE) return;
    this.fsm = STATE.WAITING;
    this._enterWaiting();
  }

  // Start the RAF render loop
  start() {
    this._lastTime = performance.now();
    this.gameLoop();
  }

  // Re-evaluate environment after zone switch
  refreshEnvironment() {
    this.timeOfDay = getTimeOfDay();
    // Weather persists within a session; only re-roll isn't needed.
  }

  getEnvironment() {
    return { timeOfDay: this.timeOfDay, weather: this.weather };
  }

  // ---- State: WAITING ----
  _enterWaiting() {
    const delay = CONFIG.BITE_MIN + Math.random() * (CONFIG.BITE_MAX - CONFIG.BITE_MIN);
    this.waitTimerId = setTimeout(() => this._bite(), delay);
    this.onStateChange(this.fsm);
  }

  _bite() {
    if (this.fsm !== STATE.WAITING) return;
    this.currentFish = rollLoot(
      this.gameState.currentZone,
      this.gameState.currentBait,
      { timeOfDay: this.timeOfDay, weather: this.weather }
    );
    this.fsm = STATE.REELING;
    this.tension = 50;
    this._fishPos = Math.random();
    clearTimeout(this.waitTimerId);
    this.onStateChange(this.fsm);
  }

  // ---- State: REELING (tension-bar minigame) ----
  _updateReeling(dt) {
    const fish = this.currentFish;
    if (!fish) return;

    const rarity = RARITY[fish.rarity];
    // Fish swims left-right (ping-pong); speed scales with rarity
    const speed = 0.15 + rarity.speed * 0.12;
    this._fishPos += speed * dt;
    const pingPong = this._fishPos % 2;
    const trackPos = pingPong <= 1 ? pingPong : 2 - pingPong;

    const margin = 80;
    const trackW = this.canvas.width - margin * 2;
    const fishX = margin + trackPos * trackW;

    // Grip bar: follows mouse X; width widened by rod bonus
    const rodGrip = this._rod.gripBonus;
    const gripW = this.mouseDown ? CONFIG.GRIP_WIDTH_HELD + rodGrip : CONFIG.GRIP_WIDTH_RELEASED + rodGrip * 0.4;
    const gripL = this.mouseX - gripW / 2;
    const gripR = this.mouseX + gripW / 2;
    const inGrip = fishX >= gripL && fishX <= gripR;

    // Weather affects tension drain (rain = slippery line)
    const weatherMod = WEATHER_TYPES[this.weather]?.tensionMod ?? 1.0;

    if (inGrip && this.mouseDown) {
      this.tension = Math.min(100, this.tension + CONFIG.TENSION_FILL_RATE * dt);
    } else {
      this.tension = Math.max(0, this.tension - CONFIG.TENSION_DRAIN_RATE * weatherMod * dt);
    }

    // Win / lose check
    if (this.tension >= 100) {
      this._catchFish();
    } else if (this.tension <= 0) {
      this._escape();
    }
  }

  // ---- State: CAUGHT ----
  _catchFish() {
    this.fsm = STATE.CAUGHT;
    this._caughtAnimStart = performance.now();
    const fish = this.currentFish;

    // Award coins
    const awarded = fish.isTrash ? 1 : fish.value;
    this.gameState.coins = (this.gameState.coins || 0) + awarded;

    // Update Fish-dex (Name, Image/rarity-color, Quantity, Record, Description)
    this.gameState.fishDex = this.gameState.fishDex || {};
    const existing = this.gameState.fishDex[fish.id] || {
      count: 0,
      record: 0,
      name: fish.name,
      rarity: fish.rarity,
      desc: fish.desc,
      value: fish.value,
      isTrash: fish.isTrash || false,
    };
    const newCount = existing.count + 1;
    existing.count = newCount;
    existing.record = Math.max(existing.record || 0, newCount);
    existing.name = fish.name;
    existing.rarity = fish.rarity;
    existing.desc = fish.desc;
    existing.value = fish.value;
    existing.isTrash = fish.isTrash || false;
    this.gameState.fishDex[fish.id] = existing;

    // Pass catch info to parent for quest tracking
    this.onCatch(this.gameState, {
      rarity: fish.rarity,
      isTrash: fish.isTrash || false,
      value: awarded,
      fishId: fish.id,
    });
    this.onStateChange(this.fsm);

    // Return to IDLE after showing success
    setTimeout(() => this._reset(), 1800);
  }

  _escape() {
    this.fsm = STATE.IDLE;
    this.currentFish = null;
    this.tension = 0;
    this.onStateChange(this.fsm);
  }

  _reset() {
    this.fsm = STATE.IDLE;
    this.currentFish = null;
    this.tension = 0;
    this._fishPos = 0;
    this.onStateChange(this.fsm);
  }

  // ---- Render loop (RAF) ----
  gameLoop = () => {
    const now = performance.now();
    const dt = (now - this._lastTime) / 1000;
    this._lastTime = now;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._drawWater();

    // Night stars + rain overlays
    if (this.timeOfDay === 'night' && this.weather !== 'rain') {
      this._drawStars(now);
    }
    if (this.weather === 'rain') {
      this._drawRain(now);
    }

    if (this.fsm === STATE.IDLE) {
      this._drawIdleScene();
      this._drawIdleInstructions();
    } else if (this.fsm === STATE.WAITING) {
      this._drawWaterEdge();
      this._drawBobber(120 + Math.sin(now * 4) * 6);
      this._drawText('Đang chờ cá cắn...', this.canvas.width / 2, 60, 16);
    } else if (this.fsm === STATE.REELING) {
      this._updateReeling(dt);
      this._drawTensionBar();
      this._drawFishTrack();
      this._drawFish();
      this._drawGripBar();
      const rarityName = RARITY[this.currentFish.rarity].name;
      this._drawText(`Tiếp cận!  ${rarityName}`, this.canvas.width / 2, 40, 18);
    } else if (this.fsm === STATE.CAUGHT) {
      this._drawWaterEdge();
      this._drawCaughtFish();
      const cf = this.currentFish;
      const awarded = cf.isTrash ? 1 : cf.value;
      this._drawText(`Đã bắt: ${cf.name}! +${awarded}`, this.canvas.width / 2, 60, 20, '#4ECDC4');
    }

    requestAnimationFrame(this.gameLoop);
  }

  // ---- Drawing helpers ----
  _drawWater() {
    const ctx = this.ctx;
    const waterColor = this._waterColor;
    const waterDark = this._waterDarkColor;

    // Fill water
    ctx.fillStyle = waterColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Surface waves + fill to bottom
    ctx.strokeStyle = waterDark;
    ctx.fillStyle = waterColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 360);
    for (let x = 0; x <= this.canvas.width; x += 20) {
      const wave = Math.sin(x * 0.02 + this._caughtAnimStart * 0.001) * 3;
      ctx.lineTo(x, 360 + wave);
    }
    ctx.lineTo(this.canvas.width, this.canvas.height);
    ctx.lineTo(0, this.canvas.height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Lily pads (day + clear only)
    if (this.timeOfDay === 'day' && this.weather !== 'rain') {
      ctx.fillStyle = '#90C36A';
      for (let i = 0; i < 4; i++) {
        const px = 100 + i * 200;
        const py = 400 + Math.sin(performance.now() * 0.002 + i) * 4;
        ctx.beginPath();
        ctx.ellipse(px, py, 18, 10, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _drawStars(now) {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.star;
    for (let i = 0; i < 40; i++) {
      const x = (i * 37 + now * 0.01) % this.canvas.width;
      const y = (i * 53) % 300;
      const size = 1 + (i % 2);
      ctx.fillRect(x, y, size, size);
    }
  }

  _drawRain(now) {
    const ctx = this.ctx;
    const t = now * 0.001;
    ctx.strokeStyle = PALETTE.rain;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 50; i++) {
      const x = (i * 31 + t * 40) % this.canvas.width;
      const y = (t * 60 + i * 13) % (this.canvas.height + 40) - 20;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 4, y + 12);
    }
    ctx.stroke();
  }

  _drawWaterEdge() {
    const ctx = this.ctx;
    ctx.strokeStyle = PALETTE.bobberDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 360);
    for (let x = 0; x <= this.canvas.width; x += 15) {
      ctx.lineTo(x, 360 + Math.sin(x * 0.03) * 3);
    }
    ctx.stroke();
  }

  _drawBobber(y) {
    const ctx = this.ctx;
    const x = this.canvas.width / 2;
    ctx.strokeStyle = PALETTE.bobberDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, y - 12);
    ctx.stroke();
    ctx.fillStyle = PALETTE.bobber;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.bobberDark;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  _drawIdleScene() {
    const ctx = this.ctx;
    const isNight = this.timeOfDay === 'night';
    const treeColor = isNight ? '#4A6F5C' : '#5D8C4A';
    ctx.fillStyle = treeColor;
    ctx.fillRect(60, 300, 20, 40);
    ctx.fillRect(50, 340, 40, 20);
    if (isNight) {
      ctx.fillStyle = PALETTE.wood;
      ctx.fillRect(700, 300, 60, 50);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(720, 320, 20, 20); // warm window light
    }
  }

  _drawIdleInstructions() {
    const isNight = this.timeOfDay === 'night';
    const label = isNight ? 'Đêm khuya... ấn "Câu" để câu thôi!' : 'Nhấn "Câu" để bắt đầu!';
    const color = isNight ? 'rgba(255,255,255,0.6)' : 'rgba(90,74,66,0.6)';
    this._drawText(label, this.canvas.width / 2, this.canvas.height / 2 + 60, 14, color);
  }

  // ---- Reeling scene ----
  _drawTensionBar() {
    const ctx = this.ctx;
    const barW = 300, barH = 18, x = (this.canvas.width - barW) / 2, y = 30;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(x, y, barW, barH);
    ctx.strokeStyle = PALETTE.wood;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barW, barH);
    const frac = this.tension / 100;
    let color = '#4CAF50';
    if (frac > 0.66) color = '#FF9800';
    if (frac > 0.85) color = '#F44336';
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW * frac, barH);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '12px "Quicksand", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Sức kéo: ${Math.round(this.tension)}%`, this.canvas.width / 2, y + barH + 14);
  }

  _drawFishTrack() {
    const ctx = this.ctx;
    const trackY = this.canvas.height / 2 + 80;
    const trackColor = this.timeOfDay === 'night' ? 'rgba(169,169,169,0.6)' : PALETTE.wood;
    ctx.strokeStyle = trackColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(80, trackY);
    ctx.lineTo(this.canvas.width - 80, trackY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawFish() {
    const fish = this.currentFish;
    if (!fish) return;
    const rarity = RARITY[fish.rarity];
    const margin = 80;
    const trackW = this.canvas.width - margin * 2;
    const pingPong = this._fishPos % 2;
    const trackPos = pingPong <= 1 ? pingPong : 2 - pingPong;
    const fishX = margin + trackPos * trackW;
    const fishY = this.canvas.height / 2 + 80;
    const size = 24 + rarity.speed * 3;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(fishX, fishY);
    ctx.fillStyle = rarity.color;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    const dir = trackPos < 0.5 ? -1 : 1;
    ctx.fillStyle = rarity.color;
    ctx.beginPath();
    ctx.moveTo(dir * size, 0);
    ctx.lineTo(dir * size * 2, -size * 0.7);
    ctx.lineTo(dir * size * 2, size * 0.7);
    ctx.closePath();
    ctx.fill();
    // Eye
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(dir * size * 0.4, -size * 0.3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawGripBar() {
    const ctx = this.ctx;
    const trackY = this.canvas.height / 2 + 80;
    const rodGrip = this._rod.gripBonus;
    const gripW = this.mouseDown ? CONFIG.GRIP_WIDTH_HELD + rodGrip : CONFIG.GRIP_WIDTH_RELEASED + rodGrip * 0.4;
    ctx.fillStyle = 'rgba(78,205,196,0.8)';
    ctx.fillRect(this.mouseX - gripW / 2, trackY - 18, gripW, 8);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.mouseX - gripW / 2, trackY - 18, gripW, 8);
  }

  _drawCaughtFish() {
    const fish = this.currentFish;
    if (!fish) return;
    const rarity = RARITY[fish.rarity];
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2 - 20;
    const size = 48;
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(cx - size / 2 + 4, cy - size / 2 + 4, size, size);
    ctx.fillStyle = rarity.color;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + size * 0.4, cy);
    ctx.lineTo(cx + size * 1.1, cy - size * 0.6);
    ctx.lineTo(cx + size * 1.1, cy + size * 0.6);
    ctx.closePath();
    ctx.fill();
    this._drawText(`${rarity.name} • ${fish.name}`, cx, cy - size - 30, 16, rarity.color);
  }

  _drawText(text, x, y, size = 14, color = PALETTE.text) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.font = `${size}px "Quicksand", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }
}

// Export everything needed by main.js / other modules
export {
  rollLoot,
  RARITY,
  RARITY_RANK,
  ZONE_FISH,
  STATE,
  BAITS,
  RODS,
  ZONES,
  WEATHER_TYPES,
  CRAB_POT_LOOT_TABLE,
  QUEST_TEMPLATES,
  getTimeOfDay,
  getRandomWeather,
  generateCrabPotLoot,
  generateDailyQuests,
};
