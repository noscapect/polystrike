// ═══════════════════════════════════════════════════════════════════════════════
// POLYSTRIKE ARENA — UT99 InstaGib FPS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Scene ─────────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  depth: true,
  stencil: false,
  preserveDrawingBuffer: true,
  powerPreference: 'high-performance',
});
const __TA_LOW_POWER = typeof navigator !== 'undefined' && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
renderer.setPixelRatio(Math.min(devicePixelRatio, __TA_LOW_POWER ? 1.5 : 2.25));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
{
  const c = renderer.domElement;
  c.style.position = 'fixed';
  c.style.inset = '0';
  c.style.width = '100%';
  c.style.height = '100%';
  c.style.zIndex = '0';
  c.style.pointerEvents = 'auto';
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080408);
scene.fog = new THREE.FogExp2(0x150b04, 0.012);

window.__TA_RENDERER = renderer;
window.__TA_SCENE = scene;

const camera = new THREE.PerspectiveCamera(90, innerWidth / innerHeight, 0.05, 600);
const CAM_HEIGHT = 0.88;

// ── Player rig ────────────────────────────────────────────────────────────────
const playerObj = new THREE.Object3D();
playerObj.add(camera);
camera.position.set(0, CAM_HEIGHT, 0);
scene.add(playerObj);

function makeContactShadowTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.06, size * 0.5, size * 0.5, size * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0.42)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const CONTACT_SHADOW_TEX = makeContactShadowTexture();
const CONTACT_SHADOW_MAT = new THREE.MeshBasicMaterial({
  map: CONTACT_SHADOW_TEX,
  transparent: true,
  opacity: 0.38,
  depthWrite: false,
  blending: THREE.NormalBlending,
});
const playerContactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 1.65), CONTACT_SHADOW_MAT.clone());
playerContactShadow.rotation.x = -Math.PI * 0.5;
playerContactShadow.renderOrder = 3;
scene.add(playerContactShadow);
const botContactShadows = new Map();

let yaw = 0, pitch = 0, velY = 0;
const GRAVITY = -34, JUMP_SPEED = 11, PLAYER_H = 2.2, MOVE_SPEED = 15;
const GROUND_ACCEL = 92;
const AIR_ACCEL = 14;
const GROUND_FRICTION = 16;
let onGround = false, canDoubleJump = true;
const playerVelXZ = new THREE.Vector3();
const ENABLE_DOUBLE_JUMP = true;

const dodgeVel    = new THREE.Vector3();
let dodgeCooldown = 0;
const lastTap     = {};
const DODGE_WINDOW = 0.24, DODGE_IMPULSE = 26;

// ── Weapon (Instagib) ─────────────────────────────────────────────────────────
const INSTAGIB = { name: 'INSTAGIB', cooldown: 0.82, range: 500, beamColor: 0xff44cc, beamLife: 0.2 };
const INSTAGIB_PLUS_BUFF_SEC = 30;
const INSTAGIB_PLUS_TNT_SPLASH_RADIUS = 10;
const CLASSIC_WEAPONS = [
  { id: 'enforcer', name: 'ENFORCER', ammo: 'bullets', cost: 1, damage: 22, cooldown: 0.24, range: 240, spread: 0.018, beamColor: 0x8ee8ff },
  { id: 'shock', name: 'SHOCK RIFLE', ammo: 'cells', cost: 1, damage: 48, cooldown: 0.7, range: 360, spread: 0.006, beamColor: 0x77b0ff },
  { id: 'rocket', name: 'ROCKET LAUNCHER', ammo: 'rockets', cost: 1, damage: 74, cooldown: 0.92, range: 300, spread: 0.015, beamColor: 0xffaa66 },
];
const CLASSIC_WEAPON_INDEX = Object.fromEntries(CLASSIC_WEAPONS.map((w, i) => [w.id, i]));
const CLASSIC_AUTOSWITCH_KEY = 'ta_classic_autoswitch_v1';

// ── HUD refs & game state ─────────────────────────────────────────────────────
const timerEl       = document.getElementById('timer');
const fragsEl       = document.getElementById('frags-val');
const deathsEl      = document.getElementById('deaths-val');
const killmsg       = document.getElementById('killmsg');
const deathscr      = document.getElementById('deathscreen');
const respawnTxt    = document.getElementById('respawntxt');
const overlay       = document.getElementById('overlay');
const startbtnSp    = document.getElementById('startbtn-sp');
const announcerEl   = document.getElementById('announcer-text');
const roundEndEl    = document.getElementById('roundend');
const roundEndTitle = document.getElementById('re-title');
const roundEndRanks = document.getElementById('re-ranks');
const roundEndNext  = document.getElementById('re-next');
const killFeedEl    = document.getElementById('killfeed');
const scoreboardEl  = document.getElementById('scoreboard');
const crosshairEl   = document.getElementById('crosshair');
const hitMarkerEl   = document.getElementById('hitmarker');
const profileToastEl = document.getElementById('profile-toast');
const deathTipEl    = document.getElementById('death-tip');
const ctfStatusEl   = document.getElementById('ctf-status');
const hudScoreLabelEl = document.getElementById('hud-score-label');
const weaponLabelEl = document.querySelector('#weapon-label .hud-lbl');
const weaponValueEl = document.querySelector('#weapon-label .hud-val');
const weaponBarEl = document.getElementById('weapon-bar');
const pauseOverlay  = document.getElementById('pause-overlay');
const sensSlider    = document.getElementById('sens-slider');
const sensVal       = document.getElementById('sens-val');
const resumebtn     = document.getElementById('resumebtn');
const quitmatchbtn  = document.getElementById('quitmatchbtn');

const MOUSE_BASE_X = 0.0022;
const MOUSE_BASE_Y = 0.0018;
let mouseSensitivity = 1;
try {
  const s = parseFloat(localStorage.getItem('ta_mouseSens'));
  if (!Number.isNaN(s) && s >= 0.35 && s <= 2) mouseSensitivity = s;
} catch (_) {}
try {
  const as = localStorage.getItem(CLASSIC_AUTOSWITCH_KEY);
  if (as === '0') classicAutoSwitchOnPickup = false;
  else if (as === '1') classicAutoSwitchOnPickup = true;
} catch (_) {}
if (sensSlider) {
  sensSlider.value = String(mouseSensitivity);
  sensVal.textContent = mouseSensitivity.toFixed(2) + '×';
}

const ROUND_INTERMISSION = 5;
const SP_FRAG_LIMIT = 50;
let spRoundDurationSec = 300;
let spSelectedMapIdx = 0;
let spSelectedCtfMapIdx = 6;
let spLockMap = true;
let spBotCount = 5;
let spGameMode = 'dm';
let spRuleset = 'instagib';
let activeRuleset = 'instagib';
let classicAutoSwitchOnPickup = true;
let debugLevelMode = false;
const USER_MAP_EDITOR_KEY = 'ta_user_map_editor_v1';
const USER_PUBLISHED_MAPS_KEY = 'ta_user_published_maps_v1';
const EDITOR_SIZE_PRESETS = [1, 2, 3, 4, 6, 8, 12];
const EDITOR_MATERIAL_PRESETS = [
  { name: 'Steel', color: 0x6b7c93, roughness: 0.5, metalness: 0.72, emissive: 0x102035, emissiveIntensity: 0.08 },
  { name: 'Concrete', color: 0x6e7179, roughness: 0.86, metalness: 0.16, emissive: 0x000000, emissiveIntensity: 0 },
  { name: 'Hazard', color: 0xb78d56, roughness: 0.42, metalness: 0.32, emissive: 0x2a1a08, emissiveIntensity: 0.2 },
  { name: 'Tech', color: 0x4f71a8, roughness: 0.36, metalness: 0.68, emissive: 0x17315a, emissiveIntensity: 0.12 },
  { name: 'Dark', color: 0x384253, roughness: 0.6, metalness: 0.54, emissive: 0x0a1018, emissiveIntensity: 0.06 },
];
const mapEditorState = {
  enabled: true,
  showHint: true,
  grid: 1,
  sizeIdx: 2,
  materialIdx: 0,
  rotateY: 0,
  activeSlotByMap: {},
  boxesByMapSlot: {},
  gameplayOverrideSlotByMap: {},
  localMapLibrary: {},
  placed: [],
  importedHelpers: [],
  activeImportedFullMap: null,
  nextId: 1,
};
const HEATMAP_STORAGE_KEY = 'ta_combat_heatmaps_v1';
const heatmapState = {
  loaded: false,
  store: {},
  overlayVisible: false,
  overlayGroup: null,
  currentKey: '',
};
let mpSelectedServerUrl = 'ws://localhost:8080';
const CTF_FACE_MAP_IDX = 7;
const DEBUG_MAP_IDX = 8;
const NORMAL_MAP_COUNT = 7;
const editorHintEl = document.getElementById('editor-hint');
const mapImportFileInputEl = document.getElementById('map-import-file-input');

const state = { alive: true, cooldown: 0, invincible: 0, kills: 0, deaths: 0, respawnTimer: 0 };
const classicState = {
  health: 100,
  bodyArmor: 0,
  thighPads: 0,
  shieldBelt: 0,
  ammo: { bullets: 60, cells: 20, rockets: 10 },
  unlocked: { enforcer: true, shock: false, rocket: false },
  activeWeapon: 'enforcer',
  uDamageTimer: 0,
  tntTimer: 0,
};
const classicItemState = {
  items: [],
};
const classicProjectiles = [];
let classicRoundStartMs = 0;

let roundTimer = spRoundDurationSec, roundActive = false, intermissionTimer = 0, lastBeepSecond = -1;
let roundEndReason = 'time';
let msgTimer = 0, announcerTimer = 0;
let killFlash = 0, hitFlash = 0;
let buffPickupFlashTimer = 0;
let buffPickupFlashKind = '';
let locked = false, started = false, gamePaused = false;
let pointerLockLossTimer = 0;
let shownFirstDeathTip = false;
let hitMarkerTimer = 0;
let shakePitch = 0, shakeYaw = 0;
let crosshairShootTimer = 0;
let postShotMoveBiasTimer = 0;
let postShotStrafeDir = 1;
let landCamKick = 0;
let profileToastTimer = 0;
const profileToastQueue = [];
const keys = {};

let multiKillCount = 0, multiKillTimer = 0, spreeCount = 0, firstBloodDone = false;
let shotsFired = 0, shotsHit = 0, bestStreak = 0, longestLife = 0, lifeStart = 0;
let lastCompletedMatchStats = {
  mode: 'SP',
  reason: '-',
  winner: '-',
  playerKills: 0,
  playerDeaths: 0,
  accuracyPct: 0,
  shotsFired: 0,
  shotsHit: 0,
  bestSpree: 0,
  longestLifeText: '—',
  endedAt: '-',
  scoreLines: [],
};

const CTF_CAPTURE_LIMIT = 5;
const CTF_FLAG_RESET_TIME = 20;
const TEAM_BLUE = 'blue';
const TEAM_RED = 'red';
window.__TA_PLAYER_TEAM = TEAM_BLUE;
const ctfState = {
  enabled: false,
  playerScore: 0,
  enemyScore: 0,
  overtime: false,
  playerTeam: TEAM_BLUE,
  enemyTeam: TEAM_RED,
  blueFlagHome: new THREE.Vector3(-58, 2.3, 0),
  redFlagHome: new THREE.Vector3(58, 2.3, 0),
  blueFlagMesh: null,
  redFlagMesh: null,
  blueFlag: { atBase: true, carrierType: null, carrierRef: null, droppedPos: null, resetTimer: 0 },
  redFlag: { atBase: true, carrierType: null, carrierRef: null, droppedPos: null, resetTimer: 0 },
};

// ── Kill feed ─────────────────────────────────────────────────────────────────
const killFeedEntries = [];

const NICK_KEY = 'ta_player_nickname';
const PROFILE_KEY = 'ta_player_profile_v1';
const XP_PER_LEVEL = 1000;
const LEVELS_PER_PRESTIGE = 100;
const RANK_TITLES = [
  'Soldier',
  'Corporal',
  'Sergeant',
  'Lieutenant',
  'Captain',
  'Major',
  'Colonel',
  'Brigadier General',
  'General',
  '5-Star General',
];

function defaultProfile() {
  return {
    nickname: '',
    totalXp: 0,
    prestige: 0,
    avatarDataUrl: '',
    stats: {
      kills: 0,
      deaths: 0,
      shots: 0,
      hits: 0,
      matches: 0,
      wins: 0,
      bestFrags: 0,
      bestSpree: 0,
      longestLife: 0,
    },
  };
}

function loadProfile() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return defaultProfile();
    return {
      nickname: typeof raw.nickname === 'string' ? raw.nickname.slice(0, 20) : '',
      totalXp: Number.isFinite(raw.totalXp) ? Math.max(0, Math.floor(raw.totalXp)) : 0,
      prestige: Number.isFinite(raw.prestige) ? Math.max(0, Math.floor(raw.prestige)) : 0,
      avatarDataUrl: typeof raw.avatarDataUrl === 'string' ? raw.avatarDataUrl : '',
      stats: Object.assign(defaultProfile().stats, raw.stats || {}),
    };
  } catch (_) {
    return defaultProfile();
  }
}

function saveProfile(p) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch (_) {}
}

function profileProgress(p) {
  const total = Math.max(0, Math.floor(p.totalXp || 0));
  const xpPerPrestige = XP_PER_LEVEL * LEVELS_PER_PRESTIGE;
  const prestige = Math.floor(total / xpPerPrestige);
  const xpInPrestige = total - prestige * xpPerPrestige;
  const level = Math.min(LEVELS_PER_PRESTIGE, Math.floor(xpInPrestige / XP_PER_LEVEL) + 1);
  const xpInLevel = xpInPrestige - (level - 1) * XP_PER_LEVEL;
  const rankIdx = Math.min(RANK_TITLES.length - 1, Math.floor((level - 1) / 10));
  return {
    prestige,
    level,
    xpInLevel,
    xpForNextLevel: XP_PER_LEVEL,
    rank: RANK_TITLES[rankIdx],
  };
}

let playerProfile = loadProfile();

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getPlayerName() {
  try {
    const n = playerProfile.nickname || localStorage.getItem(NICK_KEY);
    if (n == null || n === '') return 'You';
    const t = n.trim().slice(0, 20);
    return t.length ? t : 'You';
  } catch (_) {
    return 'You';
  }
}

function bindNicknameInputs() {
  document.querySelectorAll('[data-nick-input]').forEach(inp => {
    inp.value = playerProfile.nickname || localStorage.getItem(NICK_KEY) || '';
    inp.addEventListener('input', () => {
      const v = inp.value.slice(0, 20);
      localStorage.setItem(NICK_KEY, v);
      playerProfile.nickname = v;
      saveProfile(playerProfile);
      document.querySelectorAll('[data-nick-input]').forEach(i => { i.value = v; });
      refreshMenuLbHint();
      refreshMenuProfileName();
    });
  });
}

function getMenuProfileDisplayName() {
  const nick = getPlayerName();
  return nick === 'You' ? 'USER' : nick;
}

function refreshMenuProfileName() {
  const el = document.getElementById('menu-profile-name');
  if (el) el.textContent = getMenuProfileDisplayName();
  const pp = profileProgress(playerProfile);
  const lv = document.getElementById('menu-profile-level');
  if (lv) lv.textContent = String(pp.level);
  const rk = document.getElementById('menu-profile-rank');
  if (rk) rk.textContent = `Rank: ${pp.rank}`;
  const badge = document.getElementById('menu-avatar-badge');
  if (badge) badge.textContent = `P${pp.prestige}`;
  const avatar = document.getElementById('menu-avatar');
  if (avatar) {
    if (playerProfile.avatarDataUrl) {
      avatar.textContent = '';
      avatar.style.backgroundImage = `url("${playerProfile.avatarDataUrl}")`;
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundPosition = 'center';
    } else {
      avatar.style.backgroundImage = '';
      avatar.textContent = '👤';
    }
  }
  const xpFill = document.getElementById('menu-profile-xp-fill');
  if (xpFill) xpFill.style.width = `${Math.min(100, (pp.xpInLevel / pp.xpForNextLevel) * 100)}%`;
  updateMpRankHud();
}

function grantProfileXp(amount) {
  const add = Math.max(0, Math.floor(Number(amount) || 0));
  if (!add) return;
  const before = profileProgress(playerProfile);
  playerProfile.totalXp = Math.max(0, (playerProfile.totalXp || 0) + add);
  saveProfile(playerProfile);
  const after = profileProgress(playerProfile);
  if (after.prestige > before.prestige) profileToastQueue.push(`Prestige ${after.prestige} unlocked`);
  if (after.level > before.level) profileToastQueue.push(`Level up! ${before.level} -> ${after.level}`);
  if (after.rank !== before.rank) profileToastQueue.push(`New rank: ${after.rank}`);
  refreshMenuProfileName();
}

function addProfileStat(key, delta) {
  if (!playerProfile.stats) playerProfile.stats = defaultProfile().stats;
  const d = Number(delta) || 0;
  playerProfile.stats[key] = Math.max(0, Math.floor((playerProfile.stats[key] || 0) + d));
  saveProfile(playerProfile);
}

function updateMpRankHud() {
  const wrap = document.getElementById('mp-hud-rank');
  if (!wrap) return;
  const show = !!started;
  wrap.style.display = show ? 'block' : 'none';
  if (!show) return;
  const p = profileProgress(playerProfile);
  const lvl = document.getElementById('mp-hud-level');
  const bar = document.getElementById('mp-hud-bar');
  const tx = document.getElementById('mp-hud-xp');
  const rt = document.getElementById('mp-hud-rank-title');
  const av = document.getElementById('mp-hud-avatar');
  if (lvl) lvl.textContent = String(p.level);
  if (rt) rt.textContent = p.rank;
  if (bar && p.xpForNextLevel > 0) bar.style.width = `${Math.min(100, (p.xpInLevel / p.xpForNextLevel) * 100)}%`;
  if (tx) tx.textContent = `${p.xpInLevel} / ${p.xpForNextLevel} XP`;
  if (av) {
    if (playerProfile.avatarDataUrl) {
      av.textContent = '';
      av.style.backgroundImage = `url("${playerProfile.avatarDataUrl}")`;
      av.style.backgroundSize = 'cover';
      av.style.backgroundPosition = 'center';
    } else {
      av.style.backgroundImage = '';
      av.textContent = '👤';
    }
  }
}

window.__TA_MP_ON_PROGRESS = function () {
  if (window.__TA_MP_PROGRESS && Number.isFinite(window.__TA_MP_PROGRESS.totalXp)) {
    const before = profileProgress(playerProfile);
    if (window.__TA_MP_PROGRESS.totalXp > playerProfile.totalXp) {
      playerProfile.totalXp = Math.floor(window.__TA_MP_PROGRESS.totalXp);
      saveProfile(playerProfile);
      const after = profileProgress(playerProfile);
      if (after.prestige > before.prestige) profileToastQueue.push(`Prestige ${after.prestige} unlocked`);
      if (after.level > before.level) profileToastQueue.push(`Level up! ${before.level} -> ${after.level}`);
      if (after.rank !== before.rank) profileToastQueue.push(`New rank: ${after.rank}`);
    }
  }
  updateMpRankHud();
  refreshMenuProfileName();
};

window.refreshMenuProfileName = refreshMenuProfileName;

function initMainMenuShell() {
  const menuOverlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startbtn-sp');
  const spGameModeEl = document.getElementById('sp-gamemode');
  const spRulesetEl = document.getElementById('sp-ruleset');
  const spMapWrap = document.getElementById('sp-map-wrap');
  const ctfMapWrap = document.getElementById('ctf-map-wrap');
  const ctfMapEl = document.getElementById('ctf-map');
  const startBtnDebugRoom = document.getElementById('startbtn-debug-room');
  const startBtnDebugLevels = document.getElementById('startbtn-debug-levels');
  const startBtnDebugLevelEnter = document.getElementById('startbtn-debug-level-enter');
  const debugLevelsSubmenu = document.getElementById('menu-debug-levels-submenu');
  const debugLevelMap = document.getElementById('debug-level-map');
  const panelPlay = document.getElementById('menu-panel-play');
  const panelSettings = document.getElementById('menu-panel-settings');
  const subSingle = document.getElementById('menu-subpanel-single');
  const subMulti = document.getElementById('menu-subpanel-multi');
  const subDebug = document.getElementById('menu-subpanel-debug');
  const menuSens = document.getElementById('menu-sens-slider');
  const menuSensVal = document.getElementById('menu-sens-val');
  const pauseSens = document.getElementById('sens-slider');
  const pauseSensVal = document.getElementById('sens-val');
  const quitBtn = document.getElementById('menu-btn-quit');
  const menuVol = document.getElementById('menu-vol-slider');
  const menuVolVal = document.getElementById('menu-vol-val');
  const menuAudioMode = document.getElementById('menu-audio-mode');
  const menuBotPreset = document.getElementById('menu-bot-preset');
  const spBotDifficulty = document.getElementById('sp-bot-difficulty');
  const menuAvatar = document.getElementById('menu-avatar');
  const menuAvatarUpload = document.getElementById('menu-avatar-upload');
  const debugNavAlwaysLearn = document.getElementById('debug-nav-always-learn');
  const profileModal = document.getElementById('profile-modal');
  const pmClose = document.getElementById('pm-close');

  function selectNav(btn) {
    if (!btn || btn.disabled) return;
    document.querySelectorAll('#main-menu-nav .menu-item').forEach(b => {
      if (!b.disabled) b.classList.remove('is-selected');
    });
    btn.classList.add('is-selected');
  }

  function showPlay(mode) {
    window.__TA_MENU_MODE = mode;
    if (panelPlay) panelPlay.classList.remove('hidden');
    if (panelSettings) panelSettings.classList.add('hidden');
    if (subSingle) subSingle.classList.toggle('hidden', mode !== 'single');
    if (subMulti) subMulti.classList.toggle('hidden', mode !== 'multi');
    if (subDebug) subDebug.classList.toggle('hidden', mode !== 'debug');
    if (startBtn) startBtn.style.display = mode === 'single' ? 'inline-block' : 'none';
    if (startBtn) startBtn.textContent = 'Enter singleplayer';
    if (startBtnDebugRoom) startBtnDebugRoom.style.display = mode === 'debug' ? 'inline-block' : 'none';
    if (startBtnDebugLevels) startBtnDebugLevels.style.display = mode === 'debug' ? 'inline-block' : 'none';
    if (debugLevelsSubmenu && mode !== 'debug') debugLevelsSubmenu.classList.add('hidden');
    if (mode === 'single' && spGameModeEl) {
      const gm = spGameModeEl.value === 'ctf' ? 'ctf' : 'dm';
      if (spMapWrap) spMapWrap.style.display = gm === 'ctf' ? 'none' : '';
      if (ctfMapWrap) ctfMapWrap.style.display = gm === 'ctf' ? '' : 'none';
    }
  }

  function showSettings() {
    if (panelPlay) panelPlay.classList.add('hidden');
    if (panelSettings) panelSettings.classList.remove('hidden');
    if (menuSens && pauseSens) {
      menuSens.value = pauseSens.value;
      if (menuSensVal && pauseSensVal) menuSensVal.textContent = pauseSensVal.textContent;
    }
  }

  document.querySelectorAll('#main-menu-nav .menu-item[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.getAttribute('data-panel');
      const mode = btn.getAttribute('data-mode');
      selectNav(btn);
      if (panel === 'play') showPlay(mode || 'single');
      else if (panel === 'settings') showSettings();
    });
  });

  if (menuSens && pauseSens) {
    menuSens.addEventListener('input', () => {
      pauseSens.value = menuSens.value;
      pauseSens.dispatchEvent(new Event('input'));
      if (menuSensVal) menuSensVal.textContent = parseFloat(menuSens.value).toFixed(2) + '×';
    });
  }
  if (spGameModeEl) {
    spGameModeEl.addEventListener('change', () => {
      const gm = spGameModeEl.value === 'ctf' ? 'ctf' : 'dm';
      if (spMapWrap) spMapWrap.style.display = gm === 'ctf' ? 'none' : '';
      if (ctfMapWrap) ctfMapWrap.style.display = gm === 'ctf' ? '' : 'none';
    });
  }
  if (spRulesetEl) {
    spRulesetEl.value = spRuleset === 'instagib_plus' ? 'instagib_plus' : 'instagib';
  }
  if (ctfMapEl) ctfMapEl.value = String(CTF_FACE_MAP_IDX);

  function applyAudioFromSettingsUI() {
    if (!menuVol || !menuAudioMode) return;
    const vol = Math.max(0, Math.min(1, parseFloat(menuVol.value) || 0));
    const mode = menuAudioMode.value === 'mono' ? 'mono' : 'stereo';
    if (menuVolVal) menuVolVal.textContent = `${Math.round(vol * 100)}%`;
    if (typeof window.__TA_AUDIO_APPLY_SETTINGS === 'function') {
      window.__TA_AUDIO_APPLY_SETTINGS({ volume: vol, mode });
    }
  }
  if (menuVol && menuAudioMode) {
    const current = typeof window.__TA_AUDIO_GET_SETTINGS === 'function'
      ? window.__TA_AUDIO_GET_SETTINGS()
      : { volume: 1, mode: 'stereo' };
    menuVol.value = String(current.volume ?? 1);
    menuAudioMode.value = current.mode === 'mono' ? 'mono' : 'stereo';
    applyAudioFromSettingsUI();
    menuVol.addEventListener('input', applyAudioFromSettingsUI);
    menuAudioMode.addEventListener('change', applyAudioFromSettingsUI);
  }
  if (menuBotPreset) {
    const currentPreset = typeof window.__TA_BOT_GET_PRESET === 'function'
      ? window.__TA_BOT_GET_PRESET()
      : 'classic';
    menuBotPreset.value = currentPreset || 'classic';
    menuBotPreset.addEventListener('change', () => {
      const v = menuBotPreset.value || 'classic';
      if (typeof window.__TA_BOT_SET_PRESET === 'function') window.__TA_BOT_SET_PRESET(v, true);
    });
  }
  if (spBotDifficulty) {
    const currentDiff = typeof window.__TA_BOT_GET_DIFFICULTY === 'function'
      ? window.__TA_BOT_GET_DIFFICULTY()
      : 3;
    spBotDifficulty.value = String(Math.max(1, Math.min(5, Number(currentDiff) || 3)));
    spBotDifficulty.addEventListener('change', () => {
      const v = parseInt(spBotDifficulty.value, 10);
      const level = Number.isFinite(v) ? Math.max(1, Math.min(5, v)) : 3;
      if (typeof window.__TA_BOT_SET_DIFFICULTY === 'function') window.__TA_BOT_SET_DIFFICULTY(level, true);
    });
  }

  async function fileToAvatarDataUrl(file) {
    if (!file) return '';
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = url;
      });
      const maxSide = 192;
      const s = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
      const w = Math.max(1, Math.round(img.width * s));
      const h = Math.max(1, Math.round(img.height * s));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', 0.84);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (menuAvatar && menuAvatarUpload) {
    menuAvatar.style.cursor = 'pointer';
    menuAvatar.title = 'Click to upload profile picture';
    menuAvatar.addEventListener('click', () => menuAvatarUpload.click());
    menuAvatarUpload.addEventListener('change', async () => {
      const f = menuAvatarUpload.files && menuAvatarUpload.files[0];
      if (!f) return;
      try {
        const dataUrl = await fileToAvatarDataUrl(f);
        if (dataUrl) {
          playerProfile.avatarDataUrl = dataUrl;
          saveProfile(playerProfile);
          refreshMenuProfileName();
        }
      } catch (_) {}
      menuAvatarUpload.value = '';
    });
  }

  function renderProfileModal() {
    const pp = profileProgress(playerProfile);
    const s = playerProfile.stats || defaultProfile().stats;
    const acc = s.shots > 0 ? Math.round((s.hits / s.shots) * 100) : 0;
    const kd = s.deaths > 0 ? (s.kills / s.deaths).toFixed(2) : (s.kills > 0 ? '∞' : '0.00');
    const nameEl = document.getElementById('pm-name');
    const rankEl = document.getElementById('pm-rank');
    const xpEl = document.getElementById('pm-xp');
    const xpFill = document.getElementById('pm-xp-fill');
    const prestigeEl = document.getElementById('pm-prestige');
    const avatarEl = document.getElementById('pm-avatar');
    const statsEl = document.getElementById('pm-stats');
    if (nameEl) nameEl.textContent = getMenuProfileDisplayName();
    if (rankEl) rankEl.textContent = `${pp.rank} · Level ${pp.level}`;
    if (xpEl) xpEl.textContent = `${pp.xpInLevel} / ${pp.xpForNextLevel} XP`;
    if (xpFill) xpFill.style.width = `${Math.min(100, (pp.xpInLevel / pp.xpForNextLevel) * 100)}%`;
    if (prestigeEl) prestigeEl.textContent = `Prestige ${pp.prestige}`;
    if (avatarEl) {
      if (playerProfile.avatarDataUrl) {
        avatarEl.textContent = '';
        avatarEl.style.backgroundImage = `url("${playerProfile.avatarDataUrl}")`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
      } else {
        avatarEl.style.backgroundImage = '';
        avatarEl.textContent = '👤';
      }
    }
    if (statsEl) {
      statsEl.innerHTML = [
        ['Total kills', s.kills],
        ['Total deaths', s.deaths],
        ['K/D ratio', kd],
        ['Shots fired', s.shots],
        ['Shots hit', s.hits],
        ['Accuracy', `${acc}%`],
        ['Matches played', s.matches],
        ['Match wins', s.wins],
        ['Best round frags', s.bestFrags],
        ['Best spree', s.bestSpree],
        ['Longest life', s.longestLife > 0 ? `${s.longestLife.toFixed(1)}s` : '—'],
      ].map(([k, v]) => `<div class="pm-stat"><span>${k}</span><strong>${v}</strong></div>`).join('');
    }
  }
  function openProfileModal() {
    if (!profileModal) return;
    renderProfileModal();
    profileModal.classList.remove('hidden');
  }
  function closeProfileModal() {
    if (!profileModal) return;
    profileModal.classList.add('hidden');
  }
  const profileCard = document.querySelector('.menu-profile');
  if (profileCard) profileCard.addEventListener('click', openProfileModal);
  if (pmClose) pmClose.addEventListener('click', closeProfileModal);
  if (profileModal) {
    profileModal.addEventListener('click', e => {
      if (e.target === profileModal) closeProfileModal();
    });
  }

  if (quitBtn) {
    quitBtn.addEventListener('click', () => {
      window.close();
      setTimeout(() => alert('You can close this tab or window manually.'), 200);
    });
  }
  if (startBtnDebugLevels && debugLevelsSubmenu) {
    startBtnDebugLevels.addEventListener('click', () => {
      debugLevelsSubmenu.classList.toggle('hidden');
    });
  }
  if (startBtnDebugRoom) startBtnDebugRoom.addEventListener('click', launchDebugRoom);
  if (startBtnDebugLevelEnter && debugLevelMap) {
    startBtnDebugLevelEnter.addEventListener('click', () => {
      const ix = parseInt(debugLevelMap.value, 10);
      launchDebugLevelMode(Number.isFinite(ix) ? ix : 0);
    });
  }
  if (debugNavAlwaysLearn) {
    const cur = typeof window.__TA_NAV_GET_ALWAYS_LEARN === 'function'
      ? !!window.__TA_NAV_GET_ALWAYS_LEARN()
      : true;
    debugNavAlwaysLearn.checked = cur;
    debugNavAlwaysLearn.addEventListener('change', () => {
      if (typeof window.__TA_NAV_SET_ALWAYS_LEARN === 'function') {
        window.__TA_NAV_SET_ALWAYS_LEARN(!!debugNavAlwaysLearn.checked, true);
      }
    });
  }

  const selectable = () => Array.from(document.querySelectorAll('#main-menu-nav .menu-item:not(:disabled)'));
  document.addEventListener('keydown', e => {
    if (started || !menuOverlay || menuOverlay.style.display === 'none') return;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = selectable();
    const ix = items.findIndex(b => b.classList.contains('is-selected'));
    if (ix < 0) return;
    e.preventDefault();
    const next = e.key === 'ArrowDown' ? Math.min(items.length - 1, ix + 1) : Math.max(0, ix - 1);
    const btn = items[next];
    selectNav(btn);
    const panel = btn.getAttribute('data-panel');
    const mode = btn.getAttribute('data-mode');
    if (panel === 'play') showPlay(mode || 'single');
    else if (panel === 'settings') showSettings();
    btn.focus();
  });

  refreshMenuProfileName();
  showPlay('single');
}

function addKillFeedEntry(killer, victim, color, meta = null) {
  const hex = '#' + (color & 0xffffff).toString(16).padStart(6, '0');
  killFeedEntries.push({ killer, victim, color: hex, timer: 4, meta: meta || undefined });
  if (killFeedEntries.length > 5) killFeedEntries.shift();
  renderKillFeed();
}

function kfTagsHtml(meta) {
  if (!meta) return '';
  const parts = [];
  if (meta.splash) parts.push('<span class="kf-tag kf-tag--splash" title="TNT splash">SPL</span>');
  if (meta.udmg) parts.push('<span class="kf-tag kf-tag--udmg" title="UDamage">UD</span>');
  if (meta.tnt) parts.push('<span class="kf-tag kf-tag--tnt" title="TNT">TNT</span>');
  if (!parts.length) return '';
  return `<span class="kf-tags">${parts.join('')}</span>`;
}

function renderKillFeed() {
  killFeedEl.innerHTML = killFeedEntries.map(e => {
    const tags = kfTagsHtml(e.meta);
    return `<div class="kf-entry">${tags}<span style="color:${e.color}">${escapeHtml(e.killer)}</span> <span style="color:#665">fragged</span> <span style="color:#d0c0a0">${escapeHtml(e.victim)}</span></div>`;
  }).join('');
}

function updateKillFeed(dt) {
  let changed = false;
  for (let i = killFeedEntries.length - 1; i >= 0; i--) {
    killFeedEntries[i].timer -= dt;
    if (killFeedEntries[i].timer <= 0) { killFeedEntries.splice(i, 1); changed = true; }
  }
  if (changed) renderKillFeed();
}

// ── Scoreboard ────────────────────────────────────────────────────────────────
let showScoreboard = false;

const LB_KEY_FRAGS = 'ta_lb_best_frags';
const LB_KEY_ACC = 'ta_lb_best_acc';
const LB_MIN_SHOTS_ACC = 5;

function loadLocalBest() {
  try {
    const fs = localStorage.getItem(LB_KEY_FRAGS);
    const as = localStorage.getItem(LB_KEY_ACC);
    return {
      frags: fs !== null && fs !== '' ? parseInt(fs, 10) || 0 : 0,
      acc: as !== null && as !== '' ? parseFloat(as) : null,
    };
  } catch (_) {
    return { frags: 0, acc: null };
  }
}

function saveLocalBestIfBetter(roundKills, accPct, shotsFired) {
  const best = loadLocalBest();
  let newFrags = false, newAcc = false;
  try {
    if (roundKills > best.frags) {
      localStorage.setItem(LB_KEY_FRAGS, String(roundKills));
      newFrags = true;
    }
    if (shotsFired >= LB_MIN_SHOTS_ACC && (best.acc === null || accPct > best.acc)) {
      localStorage.setItem(LB_KEY_ACC, String(accPct));
      newAcc = true;
    }
  } catch (_) {}
  return { newFrags, newAcc, best: loadLocalBest() };
}

function refreshMenuLbHint() {
  const el = document.getElementById('lb-hint');
  if (!el) return;
  const b = loadLocalBest();
  if (b.frags <= 0 && b.acc === null) {
    el.textContent = '';
    return;
  }
  const accStr = b.acc !== null ? `${b.acc}%` : '—';
  const who = getPlayerName();
  el.textContent = `${who === 'You' ? 'Your records' : who + ' — records'} (local): ${b.frags} frags · ${accStr} accuracy (acc ≥${LB_MIN_SHOTS_ACC} shots)`;
}

function getRankings() {
  if (window.__TA_MP_ACTIVE && window.__TA_MP_STATE && window.__TA_MP_STATE.lastSnap) {
    const snap = window.__TA_MP_STATE.lastSnap;
    const slot = window.__TA_MP_STATE.slot;
    const entries = snap.entities.map(e => {
      const hex = BOT_COLORS[e.slot % 8].body;
      const color = '#' + (hex & 0xffffff).toString(16).padStart(6, '0');
      return {
        name: e.name,
        kills: e.kills,
        deaths: e.deaths,
        color,
        isPlayer: e.slot === slot,
        fakePing: e.slot === slot ? 12 : 20 + (e.slot * 7) % 100,
      };
    });
    entries.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    return entries;
  }
  const ctf = isCtfModeActive();
  const entries = [{
    name: getPlayerName(),
    kills: state.kills,
    deaths: state.deaths,
    color: ctf ? '#66aaff' : '#ff8833',
    isPlayer: true,
    fakePing: 0,
    team: ctf ? ctfState.playerTeam : null,
  }];
  for (const b of bots) {
    const hex = ctf
      ? (b.team === TEAM_BLUE ? '#66aaff' : '#ff6666')
      : ('#' + (BOT_COLORS[b.colorIdx % BOT_COLORS.length].body & 0xffffff).toString(16).padStart(6, '0'));
    entries.push({ name: b.name, kills: b.kills, deaths: b.deaths, color: hex, isPlayer: false, fakePing: b.fakePing, team: ctf ? b.team : null });
  }
  entries.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  return entries;
}

function renderScoreboard() {
  if (!showScoreboard) { scoreboardEl.style.display = 'none'; return; }
  scoreboardEl.style.display = 'block';
  const entries  = getRankings();
  const ctf = isCtfModeActive();
  const mapColor = ['#ff9944', '#66aaff', '#aa88ff', '#ddaa66', '#f58a4a', '#b5c57a', '#8ea6ff', '#7ac8ff'][currentMap] || '#ff8833';
  let h = `<div style="text-align:center;color:${mapColor};font-size:0.68rem;letter-spacing:3px;padding-bottom:6px;border-bottom:1px solid rgba(139,117,53,0.3);text-transform:uppercase;">${MAP_NAMES[currentMap]}</div>`;
  if (ctf) {
    h += `<div style="margin-top:6px;padding:6px 8px;border:1px solid rgba(120,150,200,0.25);display:flex;justify-content:space-between;font-size:0.64rem;letter-spacing:1px;">
      <span style="color:#66aaff;">BLUE TEAM: <strong>${ctfState.playerScore}</strong></span>
      <span style="color:#ff7777;">RED TEAM: <strong>${ctfState.enemyScore}</strong></span>
    </div>`;
  }
  h += `<div class="sb-hdr"><span class="sb-name">Player</span><span class="sb-stat">K</span><span class="sb-stat">D</span><span class="sb-stat" style="color:#88aacc;">K/D</span><span class="sb-stat sb-ping">PING</span></div>`;
  for (const e of entries) {
    const kd      = e.deaths > 0 ? (e.kills / e.deaths).toFixed(1) : (e.kills > 0 ? '∞' : '0.0');
    const pingCol = e.isPlayer ? '#44dd88' : (e.fakePing > 90 ? '#ff7744' : '#88cc88');
    h += `<div class="sb-row${e.isPlayer ? ' sb-you' : ''}">
      <span class="sb-name" style="color:${e.color}">${escapeHtml(e.name)}</span>
      <span class="sb-stat">${e.kills}</span><span class="sb-stat">${e.deaths}</span>
      <span class="sb-stat" style="color:#b0c8e0;">${kd}</span>
      <span class="sb-stat sb-ping" style="color:${pingCol};">${e.fakePing}</span></div>`;
  }
  const acc = shotsFired > 0 ? Math.round(shotsHit / shotsFired * 100) : 0;
  const lb = loadLocalBest();
  const lbAcc = lb.acc !== null ? `${lb.acc}%` : '—';
  h += `<div style="margin-top:6px;border-top:1px solid rgba(139,117,53,0.18);padding-top:5px;font-size:0.62rem;color:#8a7a5a;letter-spacing:1px;">ACCURACY: <span style="color:#ff8833;">${acc}%</span> &nbsp; BEST SPREE: <span style="color:#ffaa44;">${bestStreak}</span></div>`;
  h += `<div style="margin-top:4px;font-size:0.58rem;color:#6a5a4a;letter-spacing:0.5px;">RECORD: <span style="color:#aa8860;">${lb.frags}</span> frags · <span style="color:#7a9aaa;">${lbAcc}</span> acc</div>`;
  scoreboardEl.innerHTML = h;
}

// ── Kill streaks / Announcer ──────────────────────────────────────────────────
function showKillMsg(msg, color = '#ff8833') {
  killmsg.style.color = color;
  killmsg.style.textShadow = `0 0 15px ${color}`;
  killmsg.textContent = msg;
  killmsg.style.opacity = '1';
  msgTimer = 1.2;
}

async function copyScreenshotToClipboard() {
  const canvas = renderer && renderer.domElement;
  if (!canvas) return false;
  if (!window.ClipboardItem || !navigator.clipboard || typeof navigator.clipboard.write !== 'function') {
    return false;
  }
  try {
    // Ensure the current frame is present in the drawing buffer before capture.
    renderer.render(scene, camera);
    await new Promise(resolve => requestAnimationFrame(resolve));
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return false;
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch (_) {
    return false;
  }
}

function announceStreak(text, color, soundType) {
  announcerEl.textContent = text;
  announcerEl.style.color = color;
  announcerEl.style.opacity = '1';
  announcerTimer = 2.1;
  playAnnouncer(soundType);
}

function checkKillStreaks() {
  if      (multiKillCount === 2)  announceStreak('DOUBLE KILL!',      '#ff8833', 'double');
  else if (multiKillCount === 3)  announceStreak('MULTI KILL!',       '#ff6600', 'multi');
  else if (multiKillCount === 4)  announceStreak('ULTRA KILL!',       '#ff4400', 'ultra');
  else if (multiKillCount >= 5)   announceStreak('M-M-MONSTER KILL!', '#ff0000', 'monster');

  if      (spreeCount === 5)  announceStreak('KILLING SPREE!', '#ffaa44', 'spree');
  else if (spreeCount === 10) announceStreak('RAMPAGE!',       '#ff8844', 'rampage');
  else if (spreeCount === 15) announceStreak('DOMINATING!',    '#ff6644', 'dominating');
  else if (spreeCount === 20) announceStreak('UNSTOPPABLE!',   '#ff4444', 'unstoppable');
  else if (spreeCount === 25) announceStreak('GODLIKE!',       '#ff0000', 'godlike');

  if (state.kills === 1 && !firstBloodDone) {
    firstBloodDone = true;
    announceStreak('FIRST BLOOD!', '#ff2222', 'firstblood');
  }
  if (spreeCount > bestStreak) bestStreak = spreeCount;
}

// ── Round management ──────────────────────────────────────────────────────────
function persistLearnedNavAtMatchEnd() {
  if (typeof window.__TA_NAV_BAKE_NOW === 'function') {
    try { window.__TA_NAV_BAKE_NOW(); } catch (_) {}
  }
}

function showRoundEnd(reason = 'time') {
  roundActive = false;
  persistLearnedNavAtMatchEnd();
  intermissionTimer = ROUND_INTERMISSION;
  roundEndReason = reason;
  const rankings = getRankings();
  const ctf = isCtfModeActive() || reason === 'ctf' || reason === 'ctf-time';
  const ctfBlueWin = ctfState.playerScore > ctfState.enemyScore;
  const ctfRedWin = ctfState.enemyScore > ctfState.playerScore;
  const ctfTie = ctfState.playerScore === ctfState.enemyScore;
  const w = ctf ? { isPlayer: ctfBlueWin, name: ctfBlueWin ? 'Blue Team' : 'Red Team', color: ctfBlueWin ? '#66aaff' : '#ff6666' } : rankings[0];
  playRoundEndAudio(!!w.isPlayer);
  if (ctf && ctfTie) {
    roundEndTitle.textContent = 'DRAW';
    roundEndTitle.style.color = '#d0d8e0';
  } else {
    roundEndTitle.textContent = w.isPlayer ? 'YOU WIN!' : w.name.toUpperCase() + ' WINS!';
    roundEndTitle.style.color = w.isPlayer ? '#ff8833' : w.color;
  }

  let h = `<div class="re-row" style="border-bottom:1px solid rgba(139,117,53,0.25);padding-bottom:5px;">
    <span class="re-rank" style="color:#8a7a5a;font-size:0.65rem;">#</span>
    <span class="re-name" style="color:#8a7a5a;font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;">Player</span>
    <span class="re-stat" style="color:#8a7a5a;font-size:0.65rem;">K</span>
    <span class="re-stat" style="color:#8a7a5a;font-size:0.65rem;">D</span>
    <span class="re-stat" style="color:#8a7a5a;font-size:0.65rem;">K/D</span></div>`;
  if (ctf) {
    h += `<div class="re-row first"><span class="re-rank">1.</span><span class="re-name" style="color:#66aaff;">Blue Team</span><span class="re-stat">${ctfState.playerScore}</span><span class="re-stat">-</span><span class="re-stat" style="color:#b0c8e0;">caps</span></div>`;
    h += `<div class="re-row"><span class="re-rank">2.</span><span class="re-name" style="color:#ff6666;">Red Team</span><span class="re-stat">${ctfState.enemyScore}</span><span class="re-stat">-</span><span class="re-stat" style="color:#b0c8e0;">caps</span></div>`;
  } else {
    rankings.forEach((e, i) => {
      const kd = e.deaths > 0 ? (e.kills / e.deaths).toFixed(1) : (e.kills > 0 ? '∞' : '0.0');
      h += `<div class="re-row${i === 0 ? ' first' : ''}${e.isPlayer ? ' re-you' : ''}">
        <span class="re-rank">${i + 1}.</span>
        <span class="re-name" style="color:${e.color}">${escapeHtml(e.name)}</span>
        <span class="re-stat">${e.kills}</span><span class="re-stat">${e.deaths}</span>
        <span class="re-stat" style="color:#b0c8e0;">${kd}</span></div>`;
    });
  }
  const accuracy = shotsFired > 0 ? Math.round(shotsHit / shotsFired * 100) : 0;
  const lb = saveLocalBestIfBetter(state.kills, accuracy, shotsFired);
  addProfileStat('matches', 1);
  if ((!ctf && rankings[0] && rankings[0].isPlayer) || (ctf && ctfBlueWin)) addProfileStat('wins', 1);
  if (!playerProfile.stats) playerProfile.stats = defaultProfile().stats;
  playerProfile.stats.bestFrags = Math.max(playerProfile.stats.bestFrags || 0, state.kills || 0);
  playerProfile.stats.bestSpree = Math.max(playerProfile.stats.bestSpree || 0, bestStreak || 0);
  playerProfile.stats.longestLife = Math.max(playerProfile.stats.longestLife || 0, longestLife || 0);
  saveProfile(playerProfile);
  const lt = longestLife >= 60
    ? `${Math.floor(longestLife / 60)}m ${(longestLife % 60) | 0}s`
    : longestLife > 0 ? `${longestLife.toFixed(1)}s` : '—';
  lastCompletedMatchStats = {
    mode: 'SP',
    reason: reason === 'fraglimit'
      ? `Frag limit (${SP_FRAG_LIMIT})`
      : (reason === 'ctf' ? `Capture limit (${CTF_CAPTURE_LIMIT})` : (reason === 'ctf-time' ? 'CTF time limit' : 'Time limit')),
    winner: ctf ? (ctfTie ? 'Draw' : (ctfBlueWin ? 'Blue Team' : 'Red Team')) : (w && w.name ? w.name : '-'),
    playerKills: state.kills || 0,
    playerDeaths: state.deaths || 0,
    accuracyPct: accuracy,
    shotsFired: shotsFired || 0,
    shotsHit: shotsHit || 0,
    bestSpree: bestStreak || 0,
    longestLifeText: lt,
    endedAt: new Date().toLocaleTimeString(),
    scoreLines: ctf
      ? [`BLUE ${ctfState.playerScore} CAPS`, `RED  ${ctfState.enemyScore} CAPS`]
      : rankings.slice(0, 6).map((e, i) => {
          const kd = e.deaths > 0 ? (e.kills / e.deaths).toFixed(1) : (e.kills > 0 ? 'inf' : '0.0');
          const name = (e.name || '-').toString().slice(0, 12);
          return `#${i + 1} ${name}  ${e.kills}/${e.deaths}  KD ${kd}`;
        }),
  };
  h += `<div style="margin-top:10px;border-top:1px solid rgba(139,117,53,0.2);padding-top:8px;font-size:0.68rem;color:#8a7a5a;letter-spacing:1px;display:flex;gap:18px;justify-content:center;flex-wrap:wrap;">
    <span>ACCURACY <span style="color:#ff8833;">${accuracy}%</span></span>
    <span>BEST SPREE <span style="color:#ffaa44;">${bestStreak}</span></span>
    <span>LONGEST LIFE <span style="color:#88ccaa;">${lt}</span></span>
  </div>`;
  const lbAcc = lb.best.acc !== null ? `${lb.best.acc}%` : '—';
  h += `<div style="margin-top:8px;border-top:1px solid rgba(139,117,53,0.15);padding-top:8px;font-size:0.62rem;color:#7a6a5a;text-align:center;line-height:1.5;">
    <span style="letter-spacing:2px;text-transform:uppercase;color:#8a7a6a;">Personal best</span> <span style="color:#554;">(localStorage)</span><br>
    ${lb.newFrags ? '<span style="color:#ffaa44;font-weight:700;">NEW FRAG RECORD · </span>' : ''}${lb.newAcc ? '<span style="color:#66ccff;font-weight:700;">NEW ACC RECORD · </span>' : ''}
    <span style="color:#aa8860;">${lb.best.frags}</span> frags &nbsp;|&nbsp; <span style="color:#88b0c8;">${lbAcc}</span> accuracy <span style="color:#554;">(min ${LB_MIN_SHOTS_ACC} shots)</span>
  </div>`;
  roundEndRanks.innerHTML = h;
  roundEndEl.style.display = 'flex';
  if (roundEndNext) {
    roundEndNext.textContent = reason === 'fraglimit'
      ? `Frag limit (${SP_FRAG_LIMIT}) reached. Next round in ${Math.ceil(Math.max(0, intermissionTimer))}...`
      : (reason === 'ctf'
        ? `Capture limit (${CTF_CAPTURE_LIMIT}) reached. Next round in ${Math.ceil(Math.max(0, intermissionTimer))}...`
        : `Next round in ${Math.ceil(Math.max(0, intermissionTimer))}...`);
  }
  playWindowOpen();
}

function showRoundEndMP() {
  roundActive = false;
  const rankings = window.__TA_MP_RANKINGS;
  if (!rankings || !rankings.length) return;
  addProfileStat('matches', 1);
  if (rankings[0] && rankings[0].isPlayer) addProfileStat('wins', 1);
  playRoundEndAudio(rankings[0].isPlayer);
  const w = rankings[0];
  roundEndTitle.textContent = w.isPlayer ? 'YOU WIN!' : w.name.toUpperCase() + ' WINS!';
  roundEndTitle.style.color = w.isPlayer ? '#ff8833' : w.color;
  let h = `<div class="re-row" style="border-bottom:1px solid rgba(139,117,53,0.25);padding-bottom:5px;">
    <span class="re-rank" style="color:#8a7a5a;font-size:0.65rem;">#</span>
    <span class="re-name" style="color:#8a7a5a;font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;">Player</span>
    <span class="re-stat" style="color:#8a7a5a;font-size:0.65rem;">K</span>
    <span class="re-stat" style="color:#8a7a5a;font-size:0.65rem;">D</span>
    <span class="re-stat" style="color:#8a7a5a;font-size:0.65rem;">K/D</span></div>`;
  rankings.forEach((e, i) => {
    const kd = e.deaths > 0 ? (e.kills / e.deaths).toFixed(1) : (e.kills > 0 ? '∞' : '0.0');
    h += `<div class="re-row${i === 0 ? ' first' : ''}${e.isPlayer ? ' re-you' : ''}">
      <span class="re-rank">${i + 1}.</span>
      <span class="re-name" style="color:${e.color}">${escapeHtml(e.name)}</span>
      <span class="re-stat">${e.kills}</span><span class="re-stat">${e.deaths}</span>
      <span class="re-stat" style="color:#b0c8e0;">${kd}</span></div>`;
  });
  const local = rankings.find(e => e.isPlayer) || { kills: 0, deaths: 0 };
  lastCompletedMatchStats = {
    mode: 'MP',
    reason: 'Server round end',
    winner: w && w.name ? w.name : '-',
    playerKills: local.kills || 0,
    playerDeaths: local.deaths || 0,
    accuracyPct: 0,
    shotsFired: 0,
    shotsHit: 0,
    bestSpree: bestStreak || 0,
    longestLifeText: '—',
    endedAt: new Date().toLocaleTimeString(),
    scoreLines: rankings.slice(0, 6).map((e, i) => {
      const kd = e.deaths > 0 ? (e.kills / e.deaths).toFixed(1) : (e.kills > 0 ? 'inf' : '0.0');
      const name = (e.name || '-').toString().slice(0, 12);
      return `#${i + 1} ${name}  ${e.kills}/${e.deaths}  KD ${kd}`;
    }),
  };
  h += `<div style="margin-top:10px;font-size:0.65rem;color:#8a7a6a;text-align:center;">Next round begins when the server timer resets.</div>`;
  roundEndRanks.innerHTML = h;
  roundEndEl.style.display = 'flex';
  playWindowOpen();
}

function rebuildArenaForCurrentMap() {
  clearArena();
  // Clear bot AI caches when map changes
  if (typeof clearBotCaches === 'function') clearBotCaches();
  if (currentMap === 0) {
    scene.background = new THREE.Color(0x080408);
    scene.fog = new THREE.FogExp2(0x150b04, 0.012);
    buildArena(); buildLights();
  } else if (currentMap === 1) {
    scene.background = new THREE.Color(0x050a14);
    scene.fog = new THREE.FogExp2(0x080c18, 0.0065);
    buildDeck16(); buildDeck16Lights();
  } else if (currentMap === 2) {
    scene.background = new THREE.Color(0x010008);
    scene.fog = new THREE.FogExp2(0x030210, 0.004);
    buildMorpheus(); buildMorpheusLights();
  } else if (currentMap === 3) {
    scene.background = new THREE.Color(0x2a3f56);
    scene.fog = new THREE.FogExp2(0x3e5c79, 0.0032);
    buildPhobos(); buildPhobosLights();
  } else if (currentMap === 4) {
    scene.background = new THREE.Color(0x0e0808);
    scene.fog = new THREE.FogExp2(0x170e0a, 0.0058);
    buildCodex(); buildCodexLights();
  } else if (currentMap === 5 && typeof buildFactory === 'function') {
    scene.background = new THREE.Color(0x0d1218);
    scene.fog = new THREE.FogExp2(0x151d25, 0.0048);
    buildFactory(); buildFactoryLights();
  } else if (currentMap === 6 && typeof buildFletcher === 'function') {
    scene.background = new THREE.Color(0x050a18);
    scene.fog = new THREE.FogExp2(0x0c1428, 0.0045);
    buildFletcher(); buildFletcherLights();
  } else if (currentMap === CTF_FACE_MAP_IDX && typeof buildCtfFace === 'function') {
    scene.background = new THREE.Color(0x070d1c);
    scene.fog = new THREE.FogExp2(0x101a30, 0.0022);
    buildCtfFace(); buildCtfFaceLights();
  } else if (currentMap === DEBUG_MAP_IDX && typeof buildDebugLab === 'function') {
    scene.background = new THREE.Color(0x070b12);
    scene.fog = new THREE.FogExp2(0x0d1624, 0.0022);
    buildDebugLab();
    if (typeof buildDebugLabLights === 'function') buildDebugLabLights();
  } else {
    scene.background = new THREE.Color(0x080408);
    scene.fog = new THREE.FogExp2(0x150b04, 0.012);
    buildArena(); buildLights();
  }
  applyWorldMaterialBoost();
  applySavedMapEditsForCurrentMap();
  if (!debugLevelMode) {
    clearHeatmapOverlay();
    if (heatmapState.overlayGroup) {
      scene.remove(heatmapState.overlayGroup);
      heatmapState.overlayGroup = null;
    }
  } else if (heatmapState.overlayVisible) {
    renderHeatmapOverlay();
  }
}

function readUserMapEditorData() {
  try {
    const raw = JSON.parse(localStorage.getItem(USER_MAP_EDITOR_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return;
    if (raw.activeSlotByMap && typeof raw.activeSlotByMap === 'object') mapEditorState.activeSlotByMap = raw.activeSlotByMap;
    if (raw.boxesByMapSlot && typeof raw.boxesByMapSlot === 'object') mapEditorState.boxesByMapSlot = raw.boxesByMapSlot;
    if (raw.gameplayOverrideSlotByMap && typeof raw.gameplayOverrideSlotByMap === 'object') {
      mapEditorState.gameplayOverrideSlotByMap = raw.gameplayOverrideSlotByMap;
    }
  } catch (_) {}
  try {
    const raw = JSON.parse(localStorage.getItem(USER_PUBLISHED_MAPS_KEY) || 'null');
    if (raw && typeof raw === 'object' && raw.localMapLibrary && typeof raw.localMapLibrary === 'object') {
      mapEditorState.localMapLibrary = raw.localMapLibrary;
    }
  } catch (_) {}
}

function saveUserMapEditorData() {
  try {
    localStorage.setItem(USER_MAP_EDITOR_KEY, JSON.stringify({
      activeSlotByMap: mapEditorState.activeSlotByMap,
      boxesByMapSlot: mapEditorState.boxesByMapSlot,
      gameplayOverrideSlotByMap: mapEditorState.gameplayOverrideSlotByMap,
    }));
  } catch (_) {}
  try {
    localStorage.setItem(USER_PUBLISHED_MAPS_KEY, JSON.stringify({
      localMapLibrary: mapEditorState.localMapLibrary || {},
    }));
  } catch (_) {}
}

function mapSlotKey(mapIdx, slot) {
  return `${mapIdx}:${slot}`;
}

function getEditorActiveSlot(mapIdx) {
  const s = mapEditorState.activeSlotByMap[String(mapIdx)];
  return Number.isFinite(s) ? Math.max(1, Math.min(5, s | 0)) : 1;
}

function setEditorActiveSlot(mapIdx, slot) {
  mapEditorState.activeSlotByMap[String(mapIdx)] = Math.max(1, Math.min(5, slot | 0));
}

function isMapEditorAllowed() {
  return debugLevelMode && currentMap >= 0 && currentMap < NORMAL_MAP_COUNT;
}

function collectCurrentArenaBoxes() {
  return sanitizeEditorBoxes((arenaObjects || []).map(o => ({
    x: o && o.mesh ? o.mesh.position.x : 0,
    y: o && o.mesh ? o.mesh.position.y : 0,
    z: o && o.mesh ? o.mesh.position.z : 0,
    sx: Math.max(0.5, (o && o.hw ? o.hw : 0.5) * 2),
    sy: Math.max(0.5, (o && o.hh ? o.hh : 0.5) * 2),
    sz: Math.max(0.5, (o && o.hd ? o.hd : 0.5) * 2),
    rotY: o && o.mesh ? o.mesh.rotation.y : 0,
    materialIdx: 0,
  })));
}

function makeEditorMaterial(presetIdx) {
  const p = EDITOR_MATERIAL_PRESETS[presetIdx] || EDITOR_MATERIAL_PRESETS[0];
  return new THREE.MeshStandardMaterial({
    color: p.color,
    roughness: p.roughness,
    metalness: p.metalness,
    emissive: new THREE.Color(p.emissive || 0x000000),
    emissiveIntensity: p.emissiveIntensity || 0,
  });
}

function disposeEditorObject(entry) {
  if (!entry || !entry.mesh) return;
  scene.remove(entry.mesh);
  const idx = arenaObjects.findIndex(o => o.mesh === entry.mesh);
  if (idx >= 0) arenaObjects.splice(idx, 1);
  if (entry.mesh.geometry) entry.mesh.geometry.dispose();
  if (entry.mesh.material) entry.mesh.material.dispose();
}

function clearPlacedEditorObjects() {
  for (const e of mapEditorState.placed) disposeEditorObject(e);
  mapEditorState.placed.length = 0;
}

function clearImportedHelpers() {
  for (const h of mapEditorState.importedHelpers) {
    if (!h) continue;
    scene.remove(h);
    if (h.geometry) h.geometry.dispose();
    const mats = Array.isArray(h.material) ? h.material : (h.material ? [h.material] : []);
    for (const m of mats) m && m.dispose && m.dispose();
  }
  mapEditorState.importedHelpers.length = 0;
}

function addEditorBox(spec) {
  const sx = Math.max(0.5, Number(spec.sx) || 1);
  const sy = Math.max(0.5, Number(spec.sy) || 1);
  const sz = Math.max(0.5, Number(spec.sz) || 1);
  const materialIdx = Number.isFinite(spec.materialIdx) ? Math.max(0, Math.min(EDITOR_MATERIAL_PRESETS.length - 1, spec.materialIdx | 0)) : 0;
  const rotY = Number.isFinite(spec.rotY) ? spec.rotY : 0;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), makeEditorMaterial(materialIdx));
  mesh.position.set(Number(spec.x) || 0, Number(spec.y) || 1, Number(spec.z) || 0);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.taUserMapEdit = true;
  scene.add(mesh);
  arenaObjects.push({ mesh, hw: sx * 0.5, hh: sy * 0.5, hd: sz * 0.5 });
  const entry = {
    id: Number.isFinite(spec.id) ? (spec.id | 0) : mapEditorState.nextId++,
    x: mesh.position.x, y: mesh.position.y, z: mesh.position.z,
    sx, sy, sz, rotY, materialIdx, mesh,
  };
  mapEditorState.nextId = Math.max(mapEditorState.nextId, entry.id + 1);
  mapEditorState.placed.push(entry);
}

function saveCurrentEditorSlot() {
  if (!isMapEditorAllowed()) return;
  const slot = getEditorActiveSlot(currentMap);
  const key = mapSlotKey(currentMap, slot);
  mapEditorState.boxesByMapSlot[key] = mapEditorState.placed.map(e => ({
    id: e.id,
    x: Number(e.x.toFixed(3)),
    y: Number(e.y.toFixed(3)),
    z: Number(e.z.toFixed(3)),
    sx: e.sx,
    sy: e.sy,
    sz: e.sz,
    rotY: Number(e.rotY.toFixed(4)),
    materialIdx: e.materialIdx,
  }));
  mapEditorState.gameplayOverrideSlotByMap[String(currentMap)] = slot;
  saveUserMapEditorData();
  showKillMsg(`MAP SLOT ${slot} SAVED (SP OVERRIDE LAYER ACTIVE)`, '#7ee8ff');
}

function loadEditorSlot(slot, showToast = true) {
  if (!isMapEditorAllowed()) return;
  const s = Math.max(1, Math.min(5, slot | 0));
  setEditorActiveSlot(currentMap, s);
  mapEditorState.gameplayOverrideSlotByMap[String(currentMap)] = s;
  saveUserMapEditorData();
  applySavedMapEditsForCurrentMap();
  if (showToast) showKillMsg(`MAP SLOT ${s} LOADED (SP+DEBUG SYNC)`, '#8ee8ff');
}

function clearEditorSlot(slot) {
  if (!isMapEditorAllowed()) return;
  const s = Math.max(1, Math.min(5, slot | 0));
  const key = mapSlotKey(currentMap, s);
  mapEditorState.boxesByMapSlot[key] = [];
  if (Number(mapEditorState.gameplayOverrideSlotByMap[String(currentMap)]) === s) {
    delete mapEditorState.gameplayOverrideSlotByMap[String(currentMap)];
  }
  saveUserMapEditorData();
  loadEditorSlot(s, false);
  showKillMsg(`MAP SLOT ${s} RESET`, '#ffb17a');
}

function restoreOriginalBuiltInMap() {
  if (!isMapEditorAllowed()) return;
  if (currentMap < 0 || currentMap >= NORMAL_MAP_COUNT) return;
  const key = String(currentMap);
  if (Object.prototype.hasOwnProperty.call(mapEditorState.gameplayOverrideSlotByMap, key)) {
    delete mapEditorState.gameplayOverrideSlotByMap[key];
    saveUserMapEditorData();
    rebuildArenaForCurrentMap();
    showKillMsg(`RESTORED ORIGINAL ${MAP_NAMES[currentMap]}`, '#ffd27a');
  } else {
    showKillMsg('ORIGINAL MAP ALREADY ACTIVE', '#b6c7dd');
  }
}

function applySavedMapEditsForCurrentMap() {
  clearPlacedEditorObjects();
  clearImportedHelpers();
  let slot = null;
  const gs = Number(mapEditorState.gameplayOverrideSlotByMap[String(currentMap)]);
  if (Number.isFinite(gs) && gs >= 1 && gs <= 5) {
    slot = gs;
    if (isMapEditorAllowed()) setEditorActiveSlot(currentMap, gs);
  }
  if (!slot) return;
  const key = mapSlotKey(currentMap, slot);
  const arr = mapEditorState.boxesByMapSlot[key];
  if (!Array.isArray(arr)) return;
  // Legacy full-capture detection: old broken slots from earlier editor versions
  // stored whole collision maps as editor blocks, causing texture-looking glitches.
  const legacyFullCapture =
    arr.length > 140 &&
    arr.filter(b => (b && typeof b === 'object')).length > 120 &&
    arr.filter(b => Number.isFinite(Number(b.materialIdx)) ? Number(b.materialIdx) === 0 : true).length > arr.length * 0.9;
  if (legacyFullCapture) {
    mapEditorState.boxesByMapSlot[key] = [];
    if (Number(mapEditorState.gameplayOverrideSlotByMap[String(currentMap)]) === slot) {
      delete mapEditorState.gameplayOverrideSlotByMap[String(currentMap)];
    }
    saveUserMapEditorData();
    if (debugLevelMode) showKillMsg('CLEARED LEGACY BROKEN SLOT DATA', '#ffd27a');
    return;
  }
  // Legacy safety: old full-capture slots can contain copied base collision boxes.
  // Skip entries that duplicate existing arena collision boxes (keeps true user-added blocks).
  const isDuplicateBaseBox = spec => {
    const sx = Math.max(0.5, Number(spec.sx) || 1);
    const sy = Math.max(0.5, Number(spec.sy) || 1);
    const sz = Math.max(0.5, Number(spec.sz) || 1);
    const x = Number(spec.x) || 0;
    const y = Number(spec.y) || 0;
    const z = Number(spec.z) || 0;
    const epsPos = 0.06;
    const epsSize = 0.06;
    for (const o of arenaObjects) {
      if (!o || !o.mesh || !o.mesh.position) continue;
      const p = o.mesh.position;
      const ow = (o.hw || 0) * 2;
      const oh = (o.hh || 0) * 2;
      const od = (o.hd || 0) * 2;
      if (
        Math.abs(p.x - x) <= epsPos &&
        Math.abs(p.y - y) <= epsPos &&
        Math.abs(p.z - z) <= epsPos &&
        Math.abs(ow - sx) <= epsSize &&
        Math.abs(oh - sy) <= epsSize &&
        Math.abs(od - sz) <= epsSize
      ) {
        return true;
      }
    }
    return false;
  };

  let duplicateCount = 0;
  for (const spec of arr) {
    if (isDuplicateBaseBox(spec)) duplicateCount++;
  }
  // Strong scrub: if this slot is mostly base-map duplicates, treat it as corrupted
  // legacy full-capture data and disable it for gameplay/editor consistency.
  if (arr.length >= 24 && duplicateCount / Math.max(1, arr.length) >= 0.62) {
    mapEditorState.boxesByMapSlot[key] = [];
    if (Number(mapEditorState.gameplayOverrideSlotByMap[String(currentMap)]) === slot) {
      delete mapEditorState.gameplayOverrideSlotByMap[String(currentMap)];
    }
    saveUserMapEditorData();
    if (debugLevelMode) showKillMsg('AUTO-SCRUBBED CORRUPTED OVERRIDE SLOT', '#ffd27a');
    return;
  }

  for (const spec of arr) {
    if (isDuplicateBaseBox(spec)) continue;
    addEditorBox(spec);
  }
}

function buildImportedFullMapArena(payload) {
  clearPlacedEditorObjects();
  clearImportedHelpers();
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2b3648, roughness: 0.78, metalness: 0.2 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  mapEditorState.importedHelpers.push(floor);
  const amb = new THREE.AmbientLight(0x9fb5d0, 0.9);
  const sun = new THREE.DirectionalLight(0xdde9ff, 1.0);
  sun.position.set(24, 42, 16);
  sun.castShadow = true;
  scene.add(amb);
  scene.add(sun);
  mapEditorState.importedHelpers.push(amb, sun);
  const boxes = sanitizeEditorBoxes(payload && payload.boxes);
  for (const b of boxes) addEditorBox(b);
}

function ensureHeatmapStoreLoaded() {
  if (heatmapState.loaded) return;
  heatmapState.loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(HEATMAP_STORAGE_KEY) || '{}');
    heatmapState.store = raw && typeof raw === 'object' ? raw : {};
  } catch (_) {
    heatmapState.store = {};
  }
}

function saveHeatmapStore() {
  try { localStorage.setItem(HEATMAP_STORAGE_KEY, JSON.stringify(heatmapState.store)); } catch (_) {}
}

function currentArenaHeatmapKey() {
  const sigParts = (arenaObjects || []).map(o => {
    if (!o || !o.mesh || !o.mesh.position) return '0';
    const p = o.mesh.position;
    return `${Math.round(p.x * 5) / 5},${Math.round(p.y * 5) / 5},${Math.round(p.z * 5) / 5},${Math.round((o.hw * 2) * 5) / 5},${Math.round((o.hh * 2) * 5) / 5},${Math.round((o.hd * 2) * 5) / 5}`;
  }).sort();
  let h = 2166136261;
  const s = sigParts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `m${currentMap}-${(h >>> 0).toString(36)}`;
}

function ensureHeatmapForCurrentMap() {
  ensureHeatmapStoreLoaded();
  const key = currentArenaHeatmapKey();
  heatmapState.currentKey = key;
  let rec = heatmapState.store[key];
  if (!rec || typeof rec !== 'object' || !Array.isArray(rec.cells)) {
    const b = MAP_BOUNDS[currentMap] || [60, 60];
    const w = 40, h = 40;
    rec = {
      mapIdx: currentMap,
      bx: b[0],
      bz: b[1],
      w,
      h,
      cells: new Array(w * h).fill(0),
      updatedAt: Date.now(),
    };
    heatmapState.store[key] = rec;
  }
  return rec;
}

function recordCombatHeat(x, z, weight = 1) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return;
  const rec = ensureHeatmapForCurrentMap();
  const w = rec.w, h = rec.h;
  const fx = (x + rec.bx) / (rec.bx * 2);
  const fz = (z + rec.bz) / (rec.bz * 2);
  if (fx < 0 || fx > 1 || fz < 0 || fz > 1) return;
  const gx = Math.max(0, Math.min(w - 1, Math.floor(fx * w)));
  const gz = Math.max(0, Math.min(h - 1, Math.floor(fz * h)));
  const add = Math.max(0.1, Number(weight) || 1);
  const stamp = (ix, iz, mul) => {
    if (ix < 0 || iz < 0 || ix >= w || iz >= h) return;
    const idx = iz * w + ix;
    rec.cells[idx] = Math.min(9999, (rec.cells[idx] || 0) + add * mul);
  };
  stamp(gx, gz, 1.0);
  stamp(gx - 1, gz, 0.35);
  stamp(gx + 1, gz, 0.35);
  stamp(gx, gz - 1, 0.35);
  stamp(gx, gz + 1, 0.35);
  rec.updatedAt = Date.now();
  saveHeatmapStore();
  if (heatmapState.overlayVisible) renderHeatmapOverlay();
}

function clearHeatmapOverlay() {
  if (!heatmapState.overlayGroup) return;
  while (heatmapState.overlayGroup.children.length) {
    const c = heatmapState.overlayGroup.children.pop();
    heatmapState.overlayGroup.remove(c);
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
  }
}

function sampleHeatY(x, z) {
  let best = -1e9;
  for (const o of arenaObjects) {
    if (!o || !o.mesh || !o.mesh.position) continue;
    const p = o.mesh.position;
    if (Math.abs(x - p.x) > o.hw + 0.2) continue;
    if (Math.abs(z - p.z) > o.hd + 0.2) continue;
    const top = p.y + o.hh;
    if (top > best) best = top;
  }
  if (!Number.isFinite(best) || best < -500) return 0.05;
  return best + 0.05;
}

function renderHeatmapOverlay() {
  if (!heatmapState.overlayVisible || !debugLevelMode) return;
  const rec = ensureHeatmapForCurrentMap();
  if (!heatmapState.overlayGroup) {
    heatmapState.overlayGroup = new THREE.Group();
    heatmapState.overlayGroup.name = 'CombatHeatOverlay';
    scene.add(heatmapState.overlayGroup);
  }
  clearHeatmapOverlay();
  const w = rec.w, h = rec.h;
  let maxV = 0;
  for (const v of rec.cells) if (v > maxV) maxV = v;
  if (maxV <= 0.01) return;
  const geo = new THREE.PlaneGeometry((rec.bx * 2) / w * 0.94, (rec.bz * 2) / h * 0.94);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, side: THREE.DoubleSide });
  for (let iz = 0; iz < h; iz++) {
    for (let ix = 0; ix < w; ix++) {
      const v = rec.cells[iz * w + ix] || 0;
      if (v <= maxV * 0.06) continue;
      const t = Math.min(1, v / maxV);
      const x = -rec.bx + (ix + 0.5) * ((rec.bx * 2) / w);
      const z = -rec.bz + (iz + 0.5) * ((rec.bz * 2) / h);
      const y = sampleHeatY(x, z);
      const m = new THREE.Mesh(geo, mat.clone());
      m.position.set(x, y, z);
      m.rotation.x = -Math.PI * 0.5;
      m.scale.setScalar(0.55 + t * 0.65);
      const c = new THREE.Color().setHSL((1 - t) * 0.62, 0.95, 0.52);
      m.material.color.copy(c);
      m.material.opacity = 0.15 + t * 0.55;
      heatmapState.overlayGroup.add(m);
    }
  }
}

function setHeatmapOverlayVisible(active) {
  heatmapState.overlayVisible = !!active;
  if (!heatmapState.overlayVisible) {
    clearHeatmapOverlay();
    if (heatmapState.overlayGroup) {
      scene.remove(heatmapState.overlayGroup);
      heatmapState.overlayGroup = null;
    }
    return;
  }
  renderHeatmapOverlay();
}

function removeEditorBoxByRay() {
  if (!isMapEditorAllowed()) return false;
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  raycaster.set(origin, dir);
  raycaster.far = 24;
  const hits = raycaster.intersectObjects(mapEditorState.placed.map(e => e.mesh), false);
  if (!hits.length) {
    raycaster.far = Infinity;
    return false;
  }
  const mesh = hits[0].object;
  const idx = mapEditorState.placed.findIndex(e => e.mesh === mesh);
  if (idx >= 0) {
    const entry = mapEditorState.placed[idx];
    disposeEditorObject(entry);
    mapEditorState.placed.splice(idx, 1);
    showKillMsg('BLOCK REMOVED', '#ff9d9d');
  }
  raycaster.far = Infinity;
  return idx >= 0;
}

function placeEditorBoxInFront() {
  if (!isMapEditorAllowed()) return;
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const size = EDITOR_SIZE_PRESETS[mapEditorState.sizeIdx] || 3;
  const p = origin.clone().addScaledVector(dir, 6);
  const gx = mapEditorState.grid;
  p.x = Math.round(p.x / gx) * gx;
  p.y = Math.max(size * 0.5, Math.round(p.y / gx) * gx);
  p.z = Math.round(p.z / gx) * gx;
  p.x = Math.max(-MAP_BOUNDS[currentMap][0] + size * 0.5, Math.min(MAP_BOUNDS[currentMap][0] - size * 0.5, p.x));
  p.z = Math.max(-MAP_BOUNDS[currentMap][1] + size * 0.5, Math.min(MAP_BOUNDS[currentMap][1] - size * 0.5, p.z));
  addEditorBox({
    x: p.x,
    y: p.y,
    z: p.z,
    sx: size,
    sy: size,
    sz: size,
    rotY: mapEditorState.rotateY,
    materialIdx: mapEditorState.materialIdx,
  });
  showKillMsg('BLOCK PLACED', '#9cffbc');
}

function updateEditorHud() {
  if (!editorHintEl) return;
  if (!isMapEditorAllowed() || !mapEditorState.enabled || !mapEditorState.showHint || !started || gamePaused) {
    editorHintEl.style.display = 'none';
    return;
  }
  const size = EDITOR_SIZE_PRESETS[mapEditorState.sizeIdx] || 1;
  const mat = EDITOR_MATERIAL_PRESETS[mapEditorState.materialIdx] || EDITOR_MATERIAL_PRESETS[0];
  const slot = getEditorActiveSlot(currentMap);
  const localCount = Object.keys(mapEditorState.localMapLibrary || {}).length;
  const scope = 'EDIT';
  editorHintEl.style.display = 'block';
  const nav = (typeof window.__TA_NAV_STATUS === 'function') ? window.__TA_NAV_STATUS() : null;
  const navTxt = nav
    ? ` | nav ${nav.nodes}/${nav.edges} (J${nav.jumpEdges || 0}/D${nav.dropEdges || 0}) ${nav.completion || 0}%${nav.training ? ' TRAIN' : ''}${nav.overlay ? ' OVERLAY' : ''}`
    : '';
  const hmRec = ensureHeatmapForCurrentMap();
  let hmPeak = 0;
  for (const v of hmRec.cells) if (v > hmPeak) hmPeak = v;
  const heatTxt = ` | heat ${Math.round(hmPeak)}${heatmapState.overlayVisible ? ' OVERLAY' : ''}`;
  editorHintEl.textContent = `MAP EDITOR (${scope}) | slot ${slot} | size ${size} | mat ${mat.name} | local maps ${localCount}/99${navTxt}${heatTxt} | E place | Q remove | [ ] size | M material | R rotate | 1-5 slot | K save | L load | N new | O publish local | J load local | U export | I import | P restore original | Y auto-learn | Z nav overlay | X heatmap | B bake nav`;
}

function sanitizeEditorBoxes(rawBoxes) {
  if (!Array.isArray(rawBoxes)) return [];
  const out = [];
  for (const b of rawBoxes) {
    if (!b || typeof b !== 'object') continue;
    const sx = Math.max(0.5, Math.min(40, Number(b.sx) || 1));
    const sy = Math.max(0.5, Math.min(40, Number(b.sy) || 1));
    const sz = Math.max(0.5, Math.min(40, Number(b.sz) || 1));
    out.push({
      id: Number.isFinite(b.id) ? (b.id | 0) : undefined,
      x: Number.isFinite(Number(b.x)) ? Number(b.x) : 0,
      y: Number.isFinite(Number(b.y)) ? Number(b.y) : sy * 0.5,
      z: Number.isFinite(Number(b.z)) ? Number(b.z) : 0,
      sx, sy, sz,
      rotY: Number.isFinite(Number(b.rotY)) ? Number(b.rotY) : 0,
      materialIdx: Number.isFinite(Number(b.materialIdx)) ? Math.max(0, Math.min(EDITOR_MATERIAL_PRESETS.length - 1, Number(b.materialIdx) | 0)) : 0,
    });
    if (out.length >= 4000) break;
  }
  return out;
}

function buildCurrentMapPayload(nameOverride) {
  if (!isMapEditorAllowed()) return null;
  const baseMapIdx = Math.max(0, Math.min(NORMAL_MAP_COUNT - 1, currentMap | 0));
  const fullBoxes = collectCurrentArenaBoxes();
  const payload = {
    version: 1,
    type: 'polystrike-user-map',
    mapScope: 'full',
    name: String(nameOverride || `Map ${new Date().toLocaleDateString()}`).slice(0, 48),
    baseMapIdx,
    baseMapName: MAP_NAMES[baseMapIdx] || `MAP ${baseMapIdx}`,
    boxes: fullBoxes,
  };
  return payload;
}

function countLocalPublishedMaps() {
  return Object.keys(mapEditorState.localMapLibrary || {}).filter(k => mapEditorState.localMapLibrary[k]).length;
}

function firstFreeLocalMapSlot() {
  for (let i = 1; i <= 99; i++) {
    if (!mapEditorState.localMapLibrary[String(i)]) return i;
  }
  return -1;
}

function applyImportedOrLocalMapPayload(payload, saveIntoCurrentEditorSlot) {
  const base = Number(payload.baseMapIdx);
  if (!Number.isFinite(base) || base < 0 || base >= NORMAL_MAP_COUNT) {
    showKillMsg('IMPORT FAILED: INVALID BASE MAP', '#ff6f6f');
    return false;
  }
  if (!payload || payload.mapScope !== 'full') {
    showKillMsg('IMPORT FAILED: FULL MAP FILE REQUIRED', '#ff6f6f');
    return false;
  }
  const boxes = sanitizeEditorBoxes(payload.boxes);
  const slot = saveIntoCurrentEditorSlot ? getEditorActiveSlot(base) : getEditorActiveSlot(base);
  const key = mapSlotKey(base, slot);
  mapEditorState.boxesByMapSlot[key] = boxes;
  mapEditorState.gameplayOverrideSlotByMap[String(base)] = slot;
  if (debugLevelMode) setEditorActiveSlot(base, slot);
  saveUserMapEditorData();
  if (currentMap !== base) {
    currentMap = base;
  }
  activeRuleset = (spRuleset === 'instagib_plus' && !debugLevelMode && !window.__TA_MP_ACTIVE) ? 'instagib_plus' : 'instagib';
  rebuildArenaForCurrentMap();
  if (isClassicRuleset()) {
    resetClassicLoadout();
    buildClassicItemsForCurrentMap();
    clearClassicProjectiles();
    classicRoundStartMs = performance.now();
    showKillMsg('CLASSIC DEATHMATCH ACTIVE', '#8ee8ff');
    showKillMsg('POWERUPS LIVE: UDamage + Shield Belt', '#b59bff');
  } else if (isInstagibPlusRuleset()) {
    resetInstagibPlusState();
    buildClassicItemsForCurrentMap();
    clearClassicProjectiles();
    classicRoundStartMs = performance.now();
    showKillMsg('INSTAGIB+ — UDamage & Shield Belt pickups', '#ffd27a');
  } else {
    clearClassicProjectiles();
    clearClassicItems();
  }
  showKillMsg(`MAP LOADED (${boxes.length} BLOCKS)`, '#8effc9');
  return true;
}

function publishLocalMapFlow() {
  if (!isMapEditorAllowed()) return;
  const payload = buildCurrentMapPayload(prompt('Local map name (optional):', `${MAP_NAMES[currentMap]} Custom`) || '');
  if (!payload) return;
  const mode = (prompt('Publish local: type "add" for next free slot, or "replace" to choose slot 1-99', 'add') || '').trim().toLowerCase();
  let slot = -1;
  if (mode === 'replace') {
    const raw = prompt('Replace which local slot? (1-99)', '1');
    const n = raw == null ? NaN : parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 99) {
      showKillMsg('INVALID SLOT', '#ff6666');
      return;
    }
    slot = n;
  } else {
    slot = firstFreeLocalMapSlot();
    if (slot < 0) {
      showKillMsg('LOCAL MAP LIBRARY FULL (99/99)', '#ff6666');
      return;
    }
  }
  mapEditorState.localMapLibrary[String(slot)] = payload;
  saveUserMapEditorData();
  updateEditorHud();
  showKillMsg(`PUBLISHED TO LOCAL SLOT ${slot}`, '#7ee8ff');
}

function loadLocalMapFlow() {
  if (!isMapEditorAllowed()) return;
  const used = countLocalPublishedMaps();
  if (used <= 0) {
    showKillMsg('NO LOCAL MAPS PUBLISHED YET', '#ffb17a');
    return;
  }
  const raw = prompt(`Load local map slot (1-99). Used: ${used}/99`, '1');
  const slot = raw == null ? NaN : parseInt(raw, 10);
  if (!Number.isFinite(slot) || slot < 1 || slot > 99) {
    showKillMsg('INVALID SLOT', '#ff6666');
    return;
  }
  const payload = mapEditorState.localMapLibrary[String(slot)];
  if (!payload) {
    showKillMsg(`SLOT ${slot} IS EMPTY`, '#ff9d9d');
    return;
  }
  applyImportedOrLocalMapPayload(payload, false);
}

async function exportMapFlow() {
  if (!isMapEditorAllowed()) return;
  const payload = buildCurrentMapPayload(prompt('Export map name (optional):', `${MAP_NAMES[currentMap]} Full`) || '');
  if (!payload) return;
  const text = JSON.stringify(payload, null, 2);
  const safeName = String(payload.name || `map-${Date.now()}`)
    .replace(/[^a-z0-9\-_ ]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48) || `map-${Date.now()}`;
  const fileName = `${safeName}.json`;
  try {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showKillMsg(`MAP FILE EXPORTED: ${fileName}`, '#8ee8ff');
  } catch (_) {}
}

function importMapFlow() {
  if (!isMapEditorAllowed()) return;
  if (!mapImportFileInputEl) {
    showKillMsg('IMPORT INPUT NOT AVAILABLE', '#ff6f6f');
    return;
  }
  mapImportFileInputEl.value = '';
  mapImportFileInputEl.click();
}

if (mapImportFileInputEl) {
  mapImportFileInputEl.addEventListener('change', async () => {
    const file = mapImportFileInputEl.files && mapImportFileInputEl.files[0];
    if (!file) return;
    let text = '';
    try {
      text = await file.text();
    } catch (_) {
      showKillMsg('IMPORT FAILED: CANNOT READ FILE', '#ff6f6f');
      return;
    }
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch (_) {
      showKillMsg('IMPORT FAILED: BAD JSON', '#ff6f6f');
      return;
    }
    if (!payload || payload.type !== 'polystrike-user-map' || !Array.isArray(payload.boxes)) {
      showKillMsg('IMPORT FAILED: INVALID PAYLOAD', '#ff6f6f');
      return;
    }
    const mode = (prompt('Import mode: type "load" to open now, or "local" to store in local slot', 'load') || '').trim().toLowerCase();
    if (mode === 'local') {
      const replaceRaw = prompt('Store into slot 1-99, or leave empty for auto-add:', '');
      let slot = -1;
      if (replaceRaw && replaceRaw.trim()) {
        slot = parseInt(replaceRaw, 10);
        if (!Number.isFinite(slot) || slot < 1 || slot > 99) {
          showKillMsg('INVALID SLOT', '#ff6666');
          return;
        }
      } else {
        slot = firstFreeLocalMapSlot();
        if (slot < 0) {
          showKillMsg('LOCAL MAP LIBRARY FULL (99/99)', '#ff6666');
          return;
        }
      }
      mapEditorState.localMapLibrary[String(slot)] = payload;
      saveUserMapEditorData();
      updateEditorHud();
      showKillMsg(`IMPORTED FILE TO LOCAL SLOT ${slot}`, '#8ee8ff');
      return;
    }
    applyImportedOrLocalMapPayload(payload, false);
  });
}

function applySingleplayerLobbySettings() {
  const mapEl = document.getElementById('sp-map');
  const ctfMapEl = document.getElementById('ctf-map');
  const gmEl = document.getElementById('sp-gamemode');
  const rulesetEl = document.getElementById('sp-ruleset');
  const botsEl = document.getElementById('sp-bots');
  const botDiffEl = document.getElementById('sp-bot-difficulty');
  const minsEl = document.getElementById('sp-minutes');
  spGameMode = gmEl && gmEl.value === 'ctf' ? 'ctf' : 'dm';
  spRuleset = (rulesetEl && rulesetEl.value === 'instagib_plus') ? 'instagib_plus' : 'instagib';
  const mapIx = mapEl ? parseInt(mapEl.value, 10) : 0;
  spSelectedMapIdx = Number.isFinite(mapIx) ? Math.max(0, Math.min(NORMAL_MAP_COUNT - 1, mapIx)) : 0;
  const ctfMapIx = ctfMapEl ? parseInt(ctfMapEl.value, 10) : CTF_FACE_MAP_IDX;
  spSelectedCtfMapIdx = Number.isFinite(ctfMapIx) ? CTF_FACE_MAP_IDX : CTF_FACE_MAP_IDX;
  const botCount = botsEl ? parseInt(botsEl.value, 10) : 5;
  spBotCount = Number.isFinite(botCount) ? Math.max(1, Math.min(11, botCount)) : 5;
  const diffLevel = botDiffEl ? parseInt(botDiffEl.value, 10) : 3;
  const safeDiff = Number.isFinite(diffLevel) ? Math.max(1, Math.min(5, diffLevel)) : 3;
  const mins = minsEl ? parseInt(minsEl.value, 10) : 3;
  const safeMins = Number.isFinite(mins) ? Math.max(1, Math.min(30, mins)) : 3;
  spRoundDurationSec = safeMins * 60;
  window.__TA_SP_BOT_COUNT = spBotCount;
  if (typeof window.__TA_BOT_SET_DIFFICULTY === 'function') window.__TA_BOT_SET_DIFFICULTY(safeDiff, true);
  if (typeof window.__TA_SET_BOT_COUNT === 'function') window.__TA_SET_BOT_COUNT(spBotCount);
}

function startNewRound(forceMapIdx) {
  roundEndEl.style.display = 'none';
  activeRuleset = (spRuleset === 'instagib_plus' && !debugLevelMode && !window.__TA_MP_ACTIVE) ? 'instagib_plus' : 'instagib';

  if (typeof forceMapIdx === 'number' && Number.isFinite(forceMapIdx)) {
    currentMap = Math.max(0, Math.min(MAP_COUNT - 1, forceMapIdx | 0));
  } else if (spGameMode === 'ctf' && !debugLevelMode) {
    currentMap = CTF_FACE_MAP_IDX;
  } else if (!spLockMap) {
    currentMap = (currentMap + 1) % NORMAL_MAP_COUNT;
  }
  rebuildArenaForCurrentMap();
  if (isClassicRuleset()) {
    resetClassicLoadout();
    buildClassicItemsForCurrentMap();
    classicRoundStartMs = performance.now();
    showKillMsg(`CLASSIC DEATHMATCH ACTIVE (${classicItemState.items.length} ITEMS)`, '#8ee8ff');
    showKillMsg('POWERUPS LIVE: UDamage + Shield Belt', '#b59bff');
  } else if (isInstagibPlusRuleset()) {
    resetInstagibPlusState();
    buildClassicItemsForCurrentMap();
    classicRoundStartMs = performance.now();
    clearClassicProjectiles();
    showKillMsg(`INSTAGIB+ (${classicItemState.items.length} powerups)`, '#ffd27a');
  } else {
    clearClassicItems();
    if (!debugLevelMode) showKillMsg('INSTAGIB RULESET ACTIVE', '#ffd27a');
  }
  ctfState.enabled = isCtfModeActive();
  if (ctfState.enabled) {
    ctfState.playerScore = 0;
    ctfState.enemyScore = 0;
    initCtfObjects();
  } else {
    clearCtfFlags();
  }
  window.__TA_CTF_ACTIVE = ctfState.enabled;

  const mapColor = ['#ff9944', '#66aaff', '#aa88ff', '#ddaa66', '#f58a4a', '#b5c57a', '#8ea6ff', '#7ac8ff'][currentMap] || '#ff8833';
  showKillMsg(MAP_NAMES[currentMap], mapColor);

  state.alive = true; state.cooldown = 0; state.invincible = 3;
  state.kills = 0; state.deaths = 0; state.respawnTimer = 0;
  buffPickupFlashTimer = 0;
  buffPickupFlashKind = '';
  deathscr.style.display = 'none';
  if (ctfState.enabled) {
    for (let i = 0; i < bots.length; i++) {
      bots[i].team = i < Math.ceil(bots.length / 2) ? TEAM_RED : TEAM_BLUE;
      if (typeof window.__TA_BOT_APPLY_TEAM_VISUAL === 'function') {
        window.__TA_BOT_APPLY_TEAM_VISUAL(bots[i], bots[i].team);
      }
    }
  } else {
    for (const b of bots) {
      b.team = null;
      if (typeof window.__TA_BOT_APPLY_TEAM_VISUAL === 'function') {
        window.__TA_BOT_APPLY_TEAM_VISUAL(b, null);
      }
    }
  }
  for (const b of bots) { b.kills = 0; b.deaths = 0; respawnBot(b); }
  const sp = pickSafePlayerSpawn();
  playerObj.position.set(sp[0], sp[1], sp[2]);
  velY = 0; onGround = false; dodgeVel.set(0, 0, 0); playerVelXZ.set(0, 0, 0);
  multiKillCount = 0; multiKillTimer = 0; spreeCount = 0; firstBloodDone = false;
  shotsFired = 0; shotsHit = 0; bestStreak = 0; longestLife = 0; lifeStart = performance.now();
  roundTimer = spRoundDurationSec; roundActive = true; lastBeepSecond = -1;
  killFeedEntries.length = 0; renderKillFeed();
  playRoundStartAudio();
}

function formatTime(s) {
  const t = Math.max(0, Math.ceil(s));
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

function hasLineOfSightBetween(from, to, slack = 1.2) {
  const dir = to.clone().sub(from);
  const dist = dir.length();
  if (dist < 0.001) return true;
  dir.multiplyScalar(1 / dist);
  const rc = new THREE.Raycaster(from, dir, 0.1, dist - slack);
  const blockers = rc.intersectObjects(arenaObjects.filter(o => o.hw > 1.5).map(o => o.mesh), false);
  return blockers.length === 0;
}

function pickSafePlayerSpawn() {
  let pts = SPAWN_POINTS[currentMap] || [];
  if (isCtfModeActive()) {
    const team = ctfState.playerTeam;
    const filtered = pts.filter(sp => team === TEAM_BLUE ? sp[0] <= 0 : sp[0] >= 0);
    if (filtered.length) pts = filtered;
  }
  if (!pts.length) return randomSpawn();
  const playerEye = new THREE.Vector3();
  camera.getWorldPosition(playerEye);
  let best = pts[0];
  let bestScore = -Infinity;
  for (const sp of pts) {
    const spawnPos = new THREE.Vector3(sp[0], sp[1], sp[2]);
    let minBotDist = Infinity;
    let visibleBots = 0;
    let closeVisibleBots = 0;
    for (const b of bots) {
      if (!b.alive) continue;
      const bp = b.mesh.position;
      const d = spawnPos.distanceTo(bp);
      if (d < minBotDist) minBotDist = d;
      const botEye = bp.clone().add(new THREE.Vector3(0, 1.1, 0));
      if (d < 60 && hasLineOfSightBetween(botEye, spawnPos.clone().add(new THREE.Vector3(0, 1.1, 0)))) {
        visibleBots++;
        if (d < 34) closeVisibleBots++;
      }
    }
    const fromPlayer = spawnPos.distanceTo(playerEye);
    const score = minBotDist * 1.5 + fromPlayer * 0.22 - visibleBots * 28 - closeVisibleBots * 26;
    if (score > bestScore) { bestScore = score; best = sp; }
  }
  return best;
}

function isCtfModeActive() {
  return !debugLevelMode && spGameMode === 'ctf' && currentMap === CTF_FACE_MAP_IDX;
}

function clearCtfFlags() {
  if (ctfState.redFlagMesh) {
    scene.remove(ctfState.redFlagMesh);
    if (ctfState.redFlagMesh.geometry) ctfState.redFlagMesh.geometry.dispose();
    if (ctfState.redFlagMesh.material) ctfState.redFlagMesh.material.dispose();
    ctfState.redFlagMesh = null;
  }
  if (ctfState.blueFlagMesh) {
    scene.remove(ctfState.blueFlagMesh);
    if (ctfState.blueFlagMesh.geometry) ctfState.blueFlagMesh.geometry.dispose();
    if (ctfState.blueFlagMesh.material) ctfState.blueFlagMesh.material.dispose();
    ctfState.blueFlagMesh = null;
  }
}

function getFlagState(team) {
  return team === TEAM_BLUE ? ctfState.blueFlag : ctfState.redFlag;
}

function getFlagMesh(team) {
  return team === TEAM_BLUE ? ctfState.blueFlagMesh : ctfState.redFlagMesh;
}

function getFlagHome(team) {
  return team === TEAM_BLUE ? ctfState.blueFlagHome : ctfState.redFlagHome;
}

function setFlagToBase(team) {
  const st = getFlagState(team);
  const mesh = getFlagMesh(team);
  st.atBase = true;
  st.carrierType = null;
  st.carrierRef = null;
  st.droppedPos = null;
  st.resetTimer = 0;
  if (mesh) mesh.position.copy(getFlagHome(team));
}

function dropFlag(team, dropPos) {
  const st = getFlagState(team);
  st.atBase = false;
  st.carrierType = null;
  st.carrierRef = null;
  st.droppedPos = dropPos.clone();
  st.resetTimer = CTF_FLAG_RESET_TIME;
  const mesh = getFlagMesh(team);
  if (mesh) mesh.position.copy(st.droppedPos);
}

function pickupFlag(team, carrierType, carrierRef) {
  const st = getFlagState(team);
  st.atBase = false;
  st.carrierType = carrierType;
  st.carrierRef = carrierRef || null;
  st.droppedPos = null;
  st.resetTimer = 0;
}

function getEntityTeam(entityType, ref = null) {
  if (entityType === 'player') return ctfState.playerTeam;
  if (entityType === 'bot' && ref && ref.team) return ref.team;
  return null;
}

function updateFlagMeshFromCarrier(team) {
  const st = getFlagState(team);
  const mesh = getFlagMesh(team);
  if (!mesh) return;
  if (st.carrierType === 'player') {
    mesh.position.set(playerObj.position.x, playerObj.position.y + 1.9, playerObj.position.z);
  } else if (st.carrierType === 'bot' && st.carrierRef && st.carrierRef.alive) {
    mesh.position.set(st.carrierRef.mesh.position.x, st.carrierRef.mesh.position.y + 1.9, st.carrierRef.mesh.position.z);
  } else if (st.droppedPos) {
    mesh.position.copy(st.droppedPos);
  } else if (st.atBase) {
    mesh.position.copy(getFlagHome(team));
  }
}

function initCtfObjects() {
  clearCtfFlags();
  const loader = new THREE.TextureLoader();
  const tex = loader.load('assets/red-and-blue.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(1.55, 1.95);
  const redMat = new THREE.MeshStandardMaterial({
    map: tex, color: 0xff6666, transparent: true, alphaTest: 0.2,
    emissive: new THREE.Color(0x4a1515), emissiveIntensity: 0.28, roughness: 0.42, metalness: 0.24,
    side: THREE.DoubleSide,
  });
  const blueMat = new THREE.MeshStandardMaterial({
    map: tex, color: 0x66aaff, transparent: true, alphaTest: 0.2,
    emissive: new THREE.Color(0x132e58), emissiveIntensity: 0.28, roughness: 0.42, metalness: 0.24,
    side: THREE.DoubleSide,
  });
  ctfState.redFlagMesh = new THREE.Mesh(geo.clone(), redMat);
  ctfState.blueFlagMesh = new THREE.Mesh(geo.clone(), blueMat);
  ctfState.redFlagMesh.position.copy(ctfState.redFlagHome);
  ctfState.blueFlagMesh.position.copy(ctfState.blueFlagHome);
  ctfState.redFlagMesh.castShadow = true;
  ctfState.blueFlagMesh.castShadow = true;
  scene.add(ctfState.redFlagMesh);
  scene.add(ctfState.blueFlagMesh);
  setFlagToBase(TEAM_RED);
  setFlagToBase(TEAM_BLUE);
  ctfState.overtime = false;
}

function scoreCapture(capturingTeam) {
  if (capturingTeam === ctfState.playerTeam) ctfState.playerScore++;
  else ctfState.enemyScore++;
  state.kills = ctfState.playerScore;
  state.deaths = ctfState.enemyScore;
  const msg = `${capturingTeam.toUpperCase()} CAPTURE ${capturingTeam === ctfState.playerTeam ? ctfState.playerScore : ctfState.enemyScore}/${CTF_CAPTURE_LIMIT}`;
  showKillMsg(msg, capturingTeam === TEAM_BLUE ? '#6fb8ff' : '#ff8f6f');
  if (ctfState.playerScore >= CTF_CAPTURE_LIMIT || ctfState.enemyScore >= CTF_CAPTURE_LIMIT) {
    showRoundEnd('ctf');
  } else if (ctfState.overtime) {
    showRoundEnd('ctf');
  }
}

function updateCtfMode(dt) {
  if (!isCtfModeActive()) return;

  const blueFlag = getFlagState(TEAM_BLUE);
  const redFlag = getFlagState(TEAM_RED);
  const playerTeam = ctfState.playerTeam;
  const enemyTeam = ctfState.enemyTeam;

  if (ctfState.redFlagMesh) ctfState.redFlagMesh.rotation.y += dt * 2.0;
  if (ctfState.blueFlagMesh) ctfState.blueFlagMesh.rotation.y += dt * 2.0;

  // Auto reset dropped flags.
  for (const team of [TEAM_BLUE, TEAM_RED]) {
    const st = getFlagState(team);
    if (st.droppedPos && st.resetTimer > 0) {
      st.resetTimer -= dt;
      if (st.resetTimer <= 0) {
        setFlagToBase(team);
        showKillMsg(`${team.toUpperCase()} FLAG RETURNED`, team === TEAM_BLUE ? '#7db8ff' : '#ff9a7d');
      }
    }
  }

  // Player interactions.
  if (state.alive) {
    const p = playerObj.position;
    const enemyFlagTeam = enemyTeam;
    const ownFlagTeam = playerTeam;
    const enemySt = getFlagState(enemyFlagTeam);
    const ownSt = getFlagState(ownFlagTeam);
    const enemyFlagPos = enemySt.atBase ? getFlagHome(enemyFlagTeam) : (enemySt.droppedPos || (enemySt.carrierType === 'bot' && enemySt.carrierRef ? enemySt.carrierRef.mesh.position : null));
    const ownFlagPos = ownSt.atBase ? getFlagHome(ownFlagTeam) : (ownSt.droppedPos || null);

    if (enemySt.carrierType === null && enemyFlagPos && p.distanceTo(enemyFlagPos) < 2.2) {
      pickupFlag(enemyFlagTeam, 'player', null);
      showKillMsg('ENEMY FLAG TAKEN', '#99c8ff');
    }
    if (ownSt.droppedPos && ownFlagPos && p.distanceTo(ownFlagPos) < 2.2) {
      setFlagToBase(ownFlagTeam);
      showKillMsg('YOUR FLAG RETURNED', '#99ffcc');
    }
    if (enemySt.carrierType === 'player') {
      const homePos = getFlagHome(ownFlagTeam);
      if (p.distanceTo(homePos) < 2.4 && ownSt.atBase) {
        setFlagToBase(enemyFlagTeam);
        scoreCapture(playerTeam);
      }
    }
  }

  // Bot interactions (simple objective touch logic).
  for (const b of bots) {
    if (!b.alive) continue;
    const team = b.team || enemyTeam;
    const enemyFlagTeam = team === TEAM_BLUE ? TEAM_RED : TEAM_BLUE;
    const ownFlagTeam = team;
    const enemySt = getFlagState(enemyFlagTeam);
    const ownSt = getFlagState(ownFlagTeam);
    const bp = b.mesh.position;
    const enemyFlagPos = enemySt.atBase ? getFlagHome(enemyFlagTeam) : (enemySt.droppedPos || null);
    if (enemySt.carrierType === null && enemyFlagPos && bp.distanceTo(enemyFlagPos) < 2.1) {
      pickupFlag(enemyFlagTeam, 'bot', b);
    }
    if (ownSt.droppedPos && bp.distanceTo(ownSt.droppedPos) < 2.1) {
      setFlagToBase(ownFlagTeam);
    }
    if (enemySt.carrierType === 'bot' && enemySt.carrierRef === b) {
      const homePos = getFlagHome(ownFlagTeam);
      if (bp.distanceTo(homePos) < 2.3 && ownSt.atBase) {
        setFlagToBase(enemyFlagTeam);
        scoreCapture(ownFlagTeam);
      }
    }
  }

  updateFlagMeshFromCarrier(TEAM_BLUE);
  updateFlagMeshFromCarrier(TEAM_RED);
}

function updateRound(dt) {
  if (window.__TA_MP_ACTIVE && window.__TA_MP_STATE && window.__TA_MP_STATE.lastSnap) {
    const s = window.__TA_MP_STATE.lastSnap;
    roundTimer = s.roundTimer;
    roundActive = s.roundActive;
    const sec = Math.ceil(Math.max(0, roundTimer));
    timerEl.textContent = formatTime(roundTimer);
    timerEl.className = sec <= 10 ? 'warn' : '';
    return;
  }
  if (!roundActive) {
    if (intermissionTimer > 0) {
      intermissionTimer -= dt;
      roundEndNext.textContent = `Next round in ${Math.ceil(Math.max(0, intermissionTimer))}...`;
      if (intermissionTimer <= 0) startNewRound();
    }
    return;
  }
  if (isCtfModeActive()) {
    updateCtfMode(dt);
  }
  roundTimer -= dt;
  const rankingsNow = getRankings();
  const leaderKills = rankingsNow.length ? (rankingsNow[0].kills || 0) : 0;
  if (!isCtfModeActive() && leaderKills >= SP_FRAG_LIMIT) {
    showRoundEnd('fraglimit');
    return;
  }
  const sec = Math.ceil(Math.max(0, roundTimer));
  timerEl.textContent = formatTime(roundTimer);
  timerEl.className = sec <= 10 ? 'warn' : '';
  if (sec === 180 && sec !== lastBeepSecond) { lastBeepSecond = sec; playBuffer(announcerBuffers.cd3min); }
  if (sec === 60  && sec !== lastBeepSecond) { lastBeepSecond = sec; playBuffer(announcerBuffers.cd1min); }
  if (sec === 30  && sec !== lastBeepSecond) { lastBeepSecond = sec; playBuffer(announcerBuffers.cd30sec); }
  if (sec <= 10 && sec > 0 && sec !== lastBeepSecond) { lastBeepSecond = sec; playCountdownAudio(sec); }
  if (roundTimer <= 0) {
    if (isCtfModeActive()) {
      if (ctfState.playerScore === ctfState.enemyScore) {
        if (!ctfState.overtime) showKillMsg('OVERTIME - NEXT CAPTURE WINS', '#ffd27a');
        ctfState.overtime = true;
        roundTimer = 9999;
      } else {
        showRoundEnd('ctf-time');
      }
    } else {
      showRoundEnd('time');
    }
  }
}

// ── Beams & Particles ─────────────────────────────────────────────────────────
const beams = [], particles = [], shockwaves = [], burnMarks = [];
const PART_GEO = new THREE.SphereGeometry(0.1, 4, 4);
const BURN_GEO = new THREE.CircleGeometry(0.22, 20);

function spawnBeam(from, to, color, life) {
  const mat  = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, linewidth: 2 });
  const geo  = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const line = new THREE.Line(geo, mat);
  line.userData.life = life; line.userData.maxLife = life;
  scene.add(line); beams.push(line);
}

function getWorldHitNormal(hit) {
  if (!hit || !hit.face || !hit.object) return new THREE.Vector3(0, 1, 0);
  const n = hit.face.normal.clone();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  return n.applyMatrix3(normalMatrix).normalize();
}

function spawnBurnMark(point, normal) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff9a3a,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mark = new THREE.Mesh(BURN_GEO, mat);
  const n = (normal && normal.lengthSq() > 0.0001) ? normal.clone().normalize() : new THREE.Vector3(0, 1, 0);
  mark.position.copy(point).addScaledVector(n, 0.02);
  mark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  const s = 0.9 + Math.random() * 0.35;
  mark.scale.setScalar(s);
  mark.userData.life = 0.32;
  mark.userData.maxLife = 0.32;
  scene.add(mark);
  burnMarks.push(mark);
}

/**
 * Instagib kill FX: flash + shock rings + physics-like debris (gravity, drag, spin, bounce)
 * + sparks. No external physics engine — integrated per frame in updateVisuals.
 */
function spawnInstagibKillExplosion(pos, colorHex) {
  const c = new THREE.Color(colorHex);
  const cBright = c.clone().lerp(new THREE.Color(0xffffff), 0.35);

  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.98 });
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 10), flashMat);
  flash.position.copy(pos);
  flash.userData.life = 0.11;
  flash.userData.maxLife = 0.11;
  flash.userData.isFlash = true;
  flash.userData.ownGeo = true;
  scene.add(flash);
  particles.push(flash);

  spawnShockwave(pos.clone(), colorHex, false);
  spawnShockwave(pos.clone(), 0xff66cc, true);

  const burstOut = () => {
    const dir = new THREE.Vector3();
    const spdScale = 1.15;

    for (let i = 0; i < 22; i++) {
      const w = 0.06 + Math.random() * 0.22;
      const h = 0.05 + Math.random() * 0.2;
      const d = 0.06 + Math.random() * 0.2;
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({
        color: c,
        emissive: c.clone().multiplyScalar(0.4),
        emissiveIntensity: 0.9,
        metalness: 0.78,
        roughness: 0.32,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.35, Math.random() * 0.45, (Math.random() - 0.5) * 0.35));
      dir.set(Math.random() - 0.5, Math.random() * 0.55 + 0.35, Math.random() - 0.5).normalize();
      const push = (9 + Math.random() * 16) * spdScale;
      mesh.userData.vel = dir.clone().multiplyScalar(push);
      mesh.userData.angVel = new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14
      );
      mesh.userData.isDebris = true;
      mesh.userData.life = 1.35 + Math.random() * 0.55;
      mesh.userData.maxLife = mesh.userData.life;
      mesh.userData.ownGeo = true;
      mesh.userData.bounces = 0;
      mesh.userData.particleRadius = 0.1;
      scene.add(mesh);
      particles.push(mesh);
    }

    for (let i = 0; i < 16; i++) {
      const geo = new THREE.OctahedronGeometry(0.05 + Math.random() * 0.1, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: cBright,
        emissive: new THREE.Color(0xff88ee),
        emissiveIntensity: 0.6,
        metalness: 0.9,
        roughness: 0.2,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.2 + Math.random() * 0.4, (Math.random() - 0.5) * 0.25));
      dir.set(Math.random() - 0.5, Math.random() * 0.5 + 0.2, Math.random() - 0.5).normalize();
      mesh.userData.vel = dir.clone().multiplyScalar((11 + Math.random() * 20) * spdScale);
      mesh.userData.angVel = new THREE.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
      mesh.userData.isDebris = true;
      mesh.userData.life = 1.1 + Math.random() * 0.45;
      mesh.userData.maxLife = mesh.userData.life;
      mesh.userData.ownGeo = true;
      mesh.userData.bounces = 0;
      mesh.userData.particleRadius = 0.065;
      scene.add(mesh);
      particles.push(mesh);
    }

    for (let i = 0; i < 44; i++) {
      const isHot = i < 14;
      const size = isHot ? 0.04 + Math.random() * 0.07 : 0.02 + Math.random() * 0.045;
      const mat = new THREE.MeshBasicMaterial({
        color: isHot ? 0xffffff : (i % 3 === 0 ? 0xff44cc : colorHex),
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 3, 3), mat);
      mesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.35 + Math.random() * 0.7, (Math.random() - 0.5) * 0.5));
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.25) * Math.PI;
      const spd = isHot ? 16 + Math.random() * 28 : 8 + Math.random() * 18;
      mesh.userData.vel = new THREE.Vector3(
        Math.cos(a) * Math.cos(b) * spd,
        Math.sin(b) * spd + 2.5,
        Math.sin(a) * Math.cos(b) * spd
      );
      mesh.userData.isSpark = true;
      mesh.userData.life = isHot ? 0.18 + Math.random() * 0.22 : 0.28 + Math.random() * 0.32;
      mesh.userData.maxLife = mesh.userData.life;
      mesh.userData.ownGeo = true;
      mesh.userData.particleRadius = 0.038;
      scene.add(mesh);
      particles.push(mesh);
    }

    for (let i = 0; i < 12; i++) {
      const size = 0.1 + Math.random() * 0.2;
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 5, 5), mat);
      mesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.35, 0.45 + Math.random() * 0.5, (Math.random() - 0.5) * 0.35));
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.2) * Math.PI;
      const spd = 7 + Math.random() * 14;
      mesh.userData.vel = new THREE.Vector3(
        Math.cos(a) * Math.cos(b) * spd,
        Math.sin(b) * spd + 4,
        Math.sin(a) * Math.cos(b) * spd
      );
      mesh.userData.life = 0.55 + Math.random() * 0.4;
      mesh.userData.maxLife = mesh.userData.life;
      mesh.userData.isChunk = true;
      mesh.userData.ownGeo = true;
      mesh.userData.particleRadius = 0.12;
      scene.add(mesh);
      particles.push(mesh);
    }
  };
  burstOut();
}

function spawnShockwave(pos, color, fast = false) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: fast ? 0.75 : 0.9, side: THREE.DoubleSide });
  const r = fast ? 0.14 : 0.28;
  const tube = fast ? 0.045 : 0.08;
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, fast ? 36 : 30), mat);
  mesh.position.copy(pos);
  mesh.rotation.x = Math.PI / 2;
  mesh.userData.life = fast ? 0.26 : 0.42;
  mesh.userData.maxLife = mesh.userData.life;
  mesh.userData.expandRate = fast ? 26 : 12;
  mesh.userData.ownGeo = true;
  scene.add(mesh);
  shockwaves.push(mesh);
}

function isClassicRuleset() {
  return activeRuleset === 'classic';
}

function isInstagibPlusRuleset() {
  return activeRuleset === 'instagib_plus';
}

function resetInstagibPlusState() {
  classicState.uDamageTimer = 0;
  classicState.tntTimer = 0;
  classicState.shieldBelt = 0;
}

function triggerInstagibPlusPickupJuice(kind) {
  if (!isInstagibPlusRuleset()) return;
  buffPickupFlashTimer = 0.34;
  buffPickupFlashKind = kind;
}

function buildInstagibPlusKillMeta(opts) {
  if (!isInstagibPlusRuleset()) return null;
  const m = { udmg: false, tnt: false, splash: !!opts.fromTntSplash };
  if (opts.killerIsPlayer) {
    m.udmg = classicState.uDamageTimer > 0;
    m.tnt = classicState.tntTimer > 0;
  } else if (opts.killerBot) {
    m.udmg = (opts.killerBot.uDamageTimer || 0) > 0;
    m.tnt = (opts.killerBot.tntTimer || 0) > 0;
  }
  if (!m.udmg && !m.tnt && !m.splash) return null;
  return m;
}

function classicWeaponDef(id) {
  return CLASSIC_WEAPONS[CLASSIC_WEAPON_INDEX[id] ?? 0] || CLASSIC_WEAPONS[0];
}

function resetClassicLoadout() {
  classicState.health = 100;
  classicState.bodyArmor = 0;
  classicState.thighPads = 0;
  classicState.shieldBelt = 0;
  // UT-style spawn baseline: Enforcer only on round start and every respawn.
  classicState.ammo.bullets = 50;
  classicState.ammo.cells = 0;
  classicState.ammo.rockets = 0;
  classicState.unlocked.enforcer = true;
  classicState.unlocked.shock = false;
  classicState.unlocked.rocket = false;
  classicState.activeWeapon = 'enforcer';
  classicState.uDamageTimer = 0;
}

function clearClassicItems() {
  for (const it of classicItemState.items) {
    if (it.mesh) scene.remove(it.mesh);
    if (it.mesh && it.mesh.geometry) it.mesh.geometry.dispose();
    if (it.mesh && it.mesh.material) it.mesh.material.dispose();
    if (it.beam) scene.remove(it.beam);
    if (it.beam && it.beam.geometry) it.beam.geometry.dispose();
    if (it.beam && it.beam.material) it.beam.material.dispose();
  }
  classicItemState.items.length = 0;
}

function classicItemDef(type) {
  switch (type) {
    case 'health': return { color: 0x66ff99, value: 25, respawn: 16 };
    case 'armor':
    case 'body_armor': return { color: 0x66ccff, value: 100, respawn: 32 };
    case 'thigh_pads': return { color: 0x88d8ff, value: 50, respawn: 24 };
    case 'shield_belt': return { color: 0x7e9bff, value: 150, respawn: 55 };
    case 'ammo_cells': return { color: 0x66aaff, value: 14, respawn: 14 };
    case 'ammo_rockets': return { color: 0xffaa66, value: 6, respawn: 18 };
    case 'weapon_shock': return { color: 0x77b0ff, respawn: 20 };
    case 'weapon_rocket': return { color: 0xff8844, respawn: 22 };
    case 'udamage': return { color: 0x8844ff, respawn: 65 };
    case 'tnt': return { color: 0xff5522, respawn: 52 };
    default: return { color: 0xb8c8d8, respawn: 18 };
  }
}

function buildClassicItemsForCurrentMap() {
  clearClassicItems();
  if (!isClassicRuleset() && !isInstagibPlusRuleset()) return;
  let src = (typeof CLASSIC_ITEM_SPAWNS !== 'undefined' && CLASSIC_ITEM_SPAWNS[currentMap]) ? CLASSIC_ITEM_SPAWNS[currentMap] : [];
  if (isInstagibPlusRuleset()) {
    src = (Array.isArray(src) ? src : []).filter(it => it && (it.type === 'udamage' || it.type === 'shield_belt' || it.type === 'tnt'));
    const b0 = MAP_BOUNDS[currentMap] || [50, 50];
    if (!src.some(it => it && it.type === 'tnt')) {
      src.push({ type: 'tnt', x: b0[0] * 0.32, y: 1.4, z: b0[1] * -0.22 });
    }
    if (!src.length) {
      const b = b0;
      src = [
        { type: 'shield_belt', x: 0, y: 1.4, z: b[1] * 0.35 },
        { type: 'udamage', x: 0, y: 1.4, z: -b[1] * 0.35 },
        { type: 'tnt', x: b[0] * 0.28, y: 1.4, z: b[1] * 0.08 },
      ];
    }
  }
  if (!Array.isArray(src) || src.length === 0) {
    const b = MAP_BOUNDS[currentMap] || [50, 50];
    src = [
      { type: 'weapon_shock', x: 0, y: 1.4, z: 0 },
      { type: 'weapon_rocket', x: b[0] * 0.4, y: 1.4, z: 0 },
      { type: 'body_armor', x: -b[0] * 0.35, y: 1.4, z: 0 },
      { type: 'shield_belt', x: 0, y: 1.4, z: b[1] * 0.35 },
      { type: 'udamage', x: 0, y: 1.4, z: -b[1] * 0.35 },
    ];
  }
  for (const raw of src) {
    if (!raw) continue;
    const def = classicItemDef(raw.type);
    const bigOrb = raw.type === 'udamage' || raw.type === 'tnt';
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(bigOrb ? 0.98 : 0.64, 0),
      new THREE.MeshStandardMaterial({
        color: def.color,
        emissive: def.color,
        emissiveIntensity: raw.type === 'udamage' ? 1.8 : (raw.type === 'tnt' ? 1.65 : 1.0),
        roughness: 0.34,
        metalness: 0.44,
      })
    );
    mesh.position.set(raw.x, raw.y, raw.z);
    scene.add(mesh);
    const beamH = raw.type === 'udamage' ? 6.2 : (raw.type === 'tnt' ? 5.8 : 4.8);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, beamH, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: raw.type === 'udamage' ? 0.42 : (raw.type === 'tnt' ? 0.38 : 0.28),
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    beam.position.set(raw.x, raw.y + (raw.type === 'udamage' ? 3.1 : (raw.type === 'tnt' ? 2.9 : 2.4)), raw.z);
    scene.add(beam);
    classicItemState.items.push({
      type: raw.type,
      x: raw.x, y: raw.y, z: raw.z,
      mesh,
      beam,
      active: true,
      timer: 0,
      respawn: def.respawn,
    });
  }
  showKillMsg(isInstagibPlusRuleset()
    ? `INSTAGIB+ POWERUPS: ${classicItemState.items.length}`
    : `CLASSIC ITEMS SPAWNED: ${classicItemState.items.length}`, '#9fd0ff');
}

function applyClassicItemPickup(type, actor = 'player') {
  if (actor === 'player') {
    if (type === 'health') {
      if (classicState.health >= 199) return false;
      classicState.health = Math.min(199, classicState.health + 25);
      return true;
    }
    if (type === 'armor' || type === 'body_armor') {
      classicState.bodyArmor = Math.min(100, classicState.bodyArmor + 100);
      return true;
    }
    if (type === 'thigh_pads') {
      classicState.thighPads = Math.min(50, classicState.thighPads + 50);
      return true;
    }
    if (type === 'shield_belt') {
      if (isInstagibPlusRuleset()) {
        classicState.shieldBelt = 150;
        if (typeof sfxInstagibPlusPickupShield === 'function') sfxInstagibPlusPickupShield();
        triggerInstagibPlusPickupJuice('shield');
        return true;
      }
      classicState.shieldBelt = Math.min(150, classicState.shieldBelt + 150);
      return true;
    }
    if (type === 'ammo_cells') { classicState.ammo.cells = Math.min(200, classicState.ammo.cells + 14); return true; }
    if (type === 'ammo_rockets') { classicState.ammo.rockets = Math.min(80, classicState.ammo.rockets + 6); return true; }
    if (type === 'weapon_shock') {
      const wasNew = !classicState.unlocked.shock;
      classicState.unlocked.shock = true;
      classicState.ammo.cells = Math.min(200, classicState.ammo.cells + 20);
      if (wasNew && classicAutoSwitchOnPickup) classicState.activeWeapon = 'shock';
      return true;
    }
    if (type === 'weapon_rocket') {
      const wasNew = !classicState.unlocked.rocket;
      classicState.unlocked.rocket = true;
      classicState.ammo.rockets = Math.min(80, classicState.ammo.rockets + 8);
      if (wasNew && classicAutoSwitchOnPickup) classicState.activeWeapon = 'rocket';
      return true;
    }
    if (type === 'udamage') {
      classicState.uDamageTimer = isInstagibPlusRuleset() ? INSTAGIB_PLUS_BUFF_SEC : 24;
      if (isInstagibPlusRuleset()) {
        if (typeof sfxInstagibPlusPickupUdmg === 'function') sfxInstagibPlusPickupUdmg();
        triggerInstagibPlusPickupJuice('udmg');
      }
      return true;
    }
    if (type === 'tnt') {
      if (!isInstagibPlusRuleset()) return false;
      classicState.tntTimer = INSTAGIB_PLUS_BUFF_SEC;
      if (typeof sfxInstagibPlusPickupTnt === 'function') sfxInstagibPlusPickupTnt();
      triggerInstagibPlusPickupJuice('tnt');
      return true;
    }
    return false;
  }
  return false;
}

function updateClassicItems(dt) {
  if (!isClassicRuleset() && !isInstagibPlusRuleset()) return;
  for (const it of classicItemState.items) {
    if (!it.mesh) continue;
    if (it.beam) it.beam.visible = !!it.active;
    if (!it.active) {
      it.timer -= dt;
      if (it.timer <= 0) {
        it.active = true;
        it.mesh.visible = true;
        if (it.beam) it.beam.visible = true;
        if (it.type === 'udamage' || it.type === 'shield_belt' || it.type === 'tnt') {
          const lab = it.type === 'udamage' ? 'UDAMAGE' : (it.type === 'tnt' ? 'TNT' : 'SHIELD BELT');
          showKillMsg(`${lab} SPAWNED`, '#a8c4ff');
        }
      }
      continue;
    }
    it.mesh.rotation.y += dt * 1.6;
    it.mesh.position.y = it.y + Math.sin(performance.now() * 0.002 + it.x * 0.09 + it.z * 0.07) * 0.15;
    if (it.beam) {
      const by = it.type === 'udamage' ? 3.1 : (it.type === 'tnt' ? 2.9 : 2.4);
      it.beam.position.y = it.mesh.position.y + by;
      it.beam.rotation.y += dt * 0.45;
    }
    if (!state.alive) continue;
    const dx = playerObj.position.x - it.mesh.position.x;
    const dz = playerObj.position.z - it.mesh.position.z;
    if ((dx * dx + dz * dz) < 2.8) {
      if (applyClassicItemPickup(it.type, 'player')) {
        it.active = false;
        it.timer = it.respawn;
        it.mesh.visible = false;
        if (it.beam) it.beam.visible = false;
        // Avoid UI hitch from message spam on frequent pickups.
        if (it.type === 'udamage' || it.type === 'shield_belt' || it.type === 'tnt' || it.type === 'weapon_shock' || it.type === 'weapon_rocket' || it.type === 'body_armor') {
          const label = it.type === 'tnt' ? 'TNT' : it.type.replace('_', ' ').toUpperCase();
          const color = (it.type === 'udamage' || it.type === 'shield_belt') ? '#b59bff' : (it.type === 'tnt' ? '#ff9a66' : '#8ee8ff');
          showKillMsg(`PICKED ${label}`, color);
        }
      }
    }
  }
}

function classicBestItemTargetForBot(bot) {
  if ((!isClassicRuleset() && !isInstagibPlusRuleset()) || !bot || !bot.mesh) return null;
  if (isInstagibPlusRuleset()) {
    const sb = Number(bot.shieldBelt) || 0;
    const ud = Number(bot.uDamageTimer) || 0;
    const tn = Number(bot.tntTimer) || 0;
    const pk = state.kills || 0;
    const bk = bot.kills || 0;
    let scorePressure = 0;
    if (pk > bk + 3) scorePressure = 1;
    else if (pk > bk + 1) scorePressure = 0.55;
    else if (pk > bk) scorePressure = 0.3;
    const urgent = sb < 55 || ud <= 0.05 || tn <= 0.05 || scorePressure > 0.45;
    const skipChance = Math.max(0.38, 0.92 - scorePressure * 0.45);
    if (!urgent && Math.random() < skipChance) return null;
    let best = null;
    let bestScore = 1e9;
    for (const it of classicItemState.items) {
      if (!it || !it.active || !it.mesh || !it.mesh.visible) continue;
      if (it.type !== 'udamage' && it.type !== 'shield_belt' && it.type !== 'tnt') continue;
      let need = it.type === 'udamage' ? 1.15 : it.type === 'tnt' ? 1.18 : (sb < 45 ? 1.05 : 0.35);
      need *= 1 + scorePressure * 0.5;
      if (pk > bk + 2 && (it.type === 'udamage' || it.type === 'tnt')) need *= 1.4;
      const d = bot.mesh.position.distanceToSquared(it.mesh.position);
      const score = d / Math.max(0.1, need);
      if (score < bestScore) {
        bestScore = score;
        best = it.mesh.position.clone();
      }
    }
    return best;
  }
  // Item routing is opportunistic; bots should keep fighting unless they need resources.
  const hp = Number(bot.health) || 100;
  const ar = Number(bot.armor) || 0;
  const cells = (bot.ammo && bot.ammo.cells) || 0;
  const rockets = (bot.ammo && bot.ammo.rockets) || 0;
  const urgent = hp < 55 || ar < 25 || cells < 4 || rockets < 2;
  if (!urgent && Math.random() < 0.9) return null;
  let best = null;
  let bestScore = 1e9;
  for (const it of classicItemState.items) {
    if (!it || !it.active || !it.mesh || !it.mesh.visible) continue;
    let need = 0.2;
    if (it.type === 'health') need = (bot.health || 100) < 55 ? 1.0 : 0.25;
    else if (it.type === 'armor' || it.type === 'body_armor') need = (bot.armor || 0) < 35 ? 0.9 : 0.2;
    else if (it.type === 'thigh_pads') need = (bot.armor || 0) < 55 ? 0.72 : 0.18;
    else if (it.type === 'shield_belt') need = (bot.shieldBelt || 0) < 60 ? 1.15 : 0.25;
    else if (it.type === 'ammo_cells') need = ((bot.ammo && bot.ammo.cells) || 0) < 10 ? 0.7 : 0.2;
    else if (it.type === 'ammo_rockets') need = ((bot.ammo && bot.ammo.rockets) || 0) < 4 ? 0.7 : 0.2;
    else if (it.type === 'udamage') need = 1.4;
    const d = bot.mesh.position.distanceToSquared(it.mesh.position);
    const score = d / Math.max(0.1, need);
    if (score < bestScore) {
      bestScore = score;
      best = it.mesh.position.clone();
    }
  }
  return best;
}

function tryClassicPickupForBot(bot) {
  if ((!isClassicRuleset() && !isInstagibPlusRuleset()) || !bot || !bot.alive || !bot.mesh) return;
  if (performance.now() - classicRoundStartMs < 6000) return;
  for (const it of classicItemState.items) {
    if (!it || !it.active || !it.mesh || !it.mesh.visible) continue;
    const dx = bot.mesh.position.x - it.mesh.position.x;
    const dz = bot.mesh.position.z - it.mesh.position.z;
    if ((dx * dx + dz * dz) > 3.4) continue;
    let picked = false;
    if (it.type === 'health') {
      bot.health = Math.min(140, (bot.health || 100) + 25);
      picked = true;
    } else if (it.type === 'armor' || it.type === 'body_armor') {
      bot.armor = Math.min(120, (bot.armor || 0) + 40);
      picked = true;
    } else if (it.type === 'thigh_pads') {
      bot.armor = Math.min(120, (bot.armor || 0) + 25);
      picked = true;
    } else if (it.type === 'shield_belt') {
      if (isInstagibPlusRuleset()) {
        bot.shieldBelt = 150;
      } else {
        bot.shieldBelt = Math.min(120, (bot.shieldBelt || 0) + 120);
      }
      picked = true;
    } else if (it.type === 'ammo_cells') {
      bot.ammo = bot.ammo || { bullets: 0, cells: 0, rockets: 0 };
      bot.ammo.cells = Math.min(200, (bot.ammo.cells || 0) + 12);
      picked = true;
    } else if (it.type === 'ammo_rockets') {
      bot.ammo = bot.ammo || { bullets: 0, cells: 0, rockets: 0 };
      bot.ammo.rockets = Math.min(80, (bot.ammo.rockets || 0) + 5);
      picked = true;
    } else if (it.type === 'weapon_shock') {
      bot.unlocked = bot.unlocked || {};
      bot.unlocked.shock = true;
      picked = true;
    } else if (it.type === 'weapon_rocket') {
      bot.unlocked = bot.unlocked || {};
      bot.unlocked.rocket = true;
      picked = true;
    } else if (it.type === 'udamage') {
      bot.uDamageTimer = isInstagibPlusRuleset() ? INSTAGIB_PLUS_BUFF_SEC : 18;
      picked = true;
    } else if (it.type === 'tnt' && isInstagibPlusRuleset()) {
      bot.tntTimer = INSTAGIB_PLUS_BUFF_SEC;
      picked = true;
    }
    if (picked) {
      it.active = false;
      it.timer = it.respawn;
      it.mesh.visible = false;
      break;
    }
  }
}

function applyDamagePlayer(amount, attacker = null) {
  if (!state.alive) return false;
  if (!isClassicRuleset()) {
    if (amount >= 9999 || amount >= 100) instagibPlayer(attacker);
    return true;
  }
  let dmg = Math.max(1, Number(amount) || 1);
  if (classicState.shieldBelt > 0 && dmg > 0) {
    const absorb = Math.min(classicState.shieldBelt, dmg);
    classicState.shieldBelt -= absorb;
    dmg -= absorb;
  }
  if (classicState.bodyArmor > 0 && dmg > 0) {
    const absorb = Math.min(classicState.bodyArmor, Math.ceil(dmg * 0.75));
    classicState.bodyArmor -= absorb;
    dmg -= absorb;
  }
  if (classicState.thighPads > 0 && dmg > 0) {
    const absorb = Math.min(classicState.thighPads, Math.ceil(dmg * 0.5));
    classicState.thighPads -= absorb;
    dmg -= absorb;
  }
  classicState.health -= dmg;
  hitFlash = Math.max(hitFlash, 0.06);
  if (classicState.health <= 0) instagibPlayer(attacker);
  return true;
}

function applyDamageBot(bot, amount, killerRef = 'player') {
  if (!bot || !bot.alive) return false;
  if (!isClassicRuleset()) {
    killBot(bot, killerRef);
    return true;
  }
  const dmg = Math.max(1, Number(amount) || 1);
  if (!Number.isFinite(bot.health)) bot.health = 100;
  if (!Number.isFinite(bot.armor)) bot.armor = 0;
  if (!Number.isFinite(bot.shieldBelt)) bot.shieldBelt = 0;
  let rem = dmg;
  if (bot.shieldBelt > 0) {
    const absorbBelt = Math.min(bot.shieldBelt, rem);
    bot.shieldBelt -= absorbBelt;
    rem -= absorbBelt;
  }
  if (bot.armor > 0 && rem > 0) {
    const absorb = Math.min(bot.armor, Math.ceil(rem * 0.45));
    bot.armor -= absorb;
    rem -= absorb;
  }
  bot.health -= rem;
  if (bot.health <= 0) killBot(bot, killerRef);
  return true;
}

function spawnClassicProjectile(type, origin, dir, owner = 'player', damage = 20) {
  if (!isClassicRuleset() || !origin || !dir) return;
  const isRocket = type === 'rocket';
  const radius = isRocket ? 0.22 : 0.08;
  const speed = isRocket ? 38 : 132;
  const life = isRocket ? 4.2 : 1.4;
  const color = isRocket ? 0xff9944 : 0xffdd88;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, isRocket ? 8 : 6, isRocket ? 8 : 6),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: isRocket ? 0.95 : 0.9,
    })
  );
  mesh.position.copy(origin);
  if (isRocket) {
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.85, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffcc88,
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    halo.userData.rocketHalo = true;
    mesh.add(halo);
  }
  scene.add(mesh);
  const vel = dir.clone().normalize().multiplyScalar(speed);
  if (isRocket) vel.y += 0.8;
  classicProjectiles.push({
    type,
    owner,
    damage: Math.max(1, Number(damage) || 1),
    radius,
    life,
    mesh,
    vel,
    smokeTimer: 0,
  });
}

function clearClassicProjectiles() {
  while (classicProjectiles.length) {
    const p = classicProjectiles.pop();
    if (!p || !p.mesh) continue;
    scene.remove(p.mesh);
    if (p.mesh.geometry) p.mesh.geometry.dispose();
    if (p.mesh.material) p.mesh.material.dispose();
  }
}

function pointSegmentDistanceSq(p, a, b) {
  const ab = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / Math.max(1e-6, ab.lengthSq())));
  const q = a.clone().addScaledVector(ab, t);
  return q.distanceToSquared(p);
}

function explodeClassicRocket(p, hitPos, hitNormal = null) {
  const center = hitPos ? hitPos.clone() : p.mesh.position.clone();
  const n = (hitNormal && hitNormal.lengthSq() > 0.0001) ? hitNormal.clone().normalize() : new THREE.Vector3(0, 1, 0);
  spawnBurnMark(center.clone(), n);
  // Impact flash
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.58, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff0c2, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending })
  );
  flash.position.copy(center);
  flash.userData.life = 0.1;
  flash.userData.maxLife = 0.1;
  flash.userData.isFlash = true;
  flash.userData.ownGeo = true;
  scene.add(flash);
  particles.push(flash);

  spawnShockwave(center.clone(), 0xffaa66, false);
  spawnShockwave(center.clone(), 0xffddaa, true);
  spawnShockwave(center.clone().addScaledVector(n, 0.03), 0xff8844, false);
  // Hot sparks + debris burst
  for (let i = 0; i < 18; i++) {
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.03 + Math.random() * 0.04, 3, 3),
      new THREE.MeshBasicMaterial({ color: i < 8 ? 0xffffff : 0xffaa55, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    spark.position.copy(center).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.12 + Math.random() * 0.35, (Math.random() - 0.5) * 0.3));
    const a = Math.random() * Math.PI * 2;
    const b = (Math.random() - 0.2) * Math.PI;
    const spd = 8 + Math.random() * 15;
    spark.userData.vel = new THREE.Vector3(
      Math.cos(a) * Math.cos(b) * spd,
      Math.sin(b) * spd + 2.5,
      Math.sin(a) * Math.cos(b) * spd
    );
    spark.userData.isSpark = true;
    spark.userData.life = 0.18 + Math.random() * 0.25;
    spark.userData.maxLife = spark.userData.life;
    spark.userData.ownGeo = true;
    spark.userData.particleRadius = 0.035;
    scene.add(spark);
    particles.push(spark);
  }
  for (let i = 0; i < 10; i++) {
    const chunk = new THREE.Mesh(
      new THREE.BoxGeometry(0.06 + Math.random() * 0.14, 0.04 + Math.random() * 0.1, 0.06 + Math.random() * 0.14),
      new THREE.MeshStandardMaterial({ color: 0xff9955, emissive: 0x662b08, emissiveIntensity: 0.65, metalness: 0.58, roughness: 0.5, transparent: true, opacity: 1 })
    );
    chunk.position.copy(center).add(new THREE.Vector3((Math.random() - 0.5) * 0.28, 0.1 + Math.random() * 0.24, (Math.random() - 0.5) * 0.28));
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.55 + 0.15, Math.random() - 0.5).normalize().multiplyScalar(6 + Math.random() * 12);
    chunk.userData.vel = v;
    chunk.userData.angVel = new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    chunk.userData.isDebris = true;
    chunk.userData.life = 0.55 + Math.random() * 0.45;
    chunk.userData.maxLife = chunk.userData.life;
    chunk.userData.ownGeo = true;
    chunk.userData.bounces = 0;
    chunk.userData.particleRadius = 0.08;
    scene.add(chunk);
    particles.push(chunk);
  }
  const blastR = 5.4;
  const blastR2 = blastR * blastR;
  if (state.alive) {
    const d2 = playerObj.position.distanceToSquared(center);
    if (d2 <= blastR2) {
      const fall = 1 - Math.min(1, Math.sqrt(d2) / blastR);
      applyDamagePlayer(Math.round(p.damage * (0.45 + fall * 0.55)), p.owner && p.owner !== 'player' ? p.owner : null);
    }
  }
  for (const b of bots) {
    if (!b || !b.alive) continue;
    if (p.owner !== 'player' && p.owner === b) continue;
    const d2 = b.mesh.position.distanceToSquared(center);
    if (d2 > blastR2) continue;
    const fall = 1 - Math.min(1, Math.sqrt(d2) / blastR);
    const dmg = Math.round(p.damage * (0.45 + fall * 0.55));
    if (p.owner === 'player') applyDamageBot(b, dmg, 'player');
    else applyDamageBot(b, dmg, p.owner || null);
  }
}

function updateClassicProjectiles(dt) {
  if (!isClassicRuleset() || !roundActive) {
    if (classicProjectiles.length) clearClassicProjectiles();
    return;
  }
  const arenaMeshes = arenaObjects.map(o => o.mesh);
  for (let i = classicProjectiles.length - 1; i >= 0; i--) {
    const p = classicProjectiles[i];
    p.life -= dt;
    if (p.life <= 0) {
      if (p.type === 'rocket') explodeClassicRocket(p, null);
      scene.remove(p.mesh);
      if (p.mesh.geometry) p.mesh.geometry.dispose();
      if (p.mesh.material) p.mesh.material.dispose();
      classicProjectiles.splice(i, 1);
      continue;
    }
    const prev = p.mesh.position.clone();
    if (p.type === 'rocket') p.vel.y += GRAVITY * 0.15 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    const cur = p.mesh.position;
    if (p.type === 'rocket') {
      p.smokeTimer = (p.smokeTimer || 0) - dt;
      if (p.smokeTimer <= 0) {
        p.smokeTimer = 0.02 + Math.random() * 0.018;
        const smoke = new THREE.Mesh(
          new THREE.SphereGeometry(0.1 + Math.random() * 0.08, 5, 5),
          new THREE.MeshBasicMaterial({
            color: 0xffa860,
            transparent: true,
            opacity: 0.42,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        smoke.position.copy(prev).add(new THREE.Vector3((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08));
        smoke.userData.life = 0.2 + Math.random() * 0.16;
        smoke.userData.maxLife = smoke.userData.life;
        smoke.userData.isSpark = true;
        smoke.userData.vel = p.vel.clone().multiplyScalar(-0.06).add(new THREE.Vector3((Math.random() - 0.5) * 0.45, Math.random() * 0.25, (Math.random() - 0.5) * 0.45));
        smoke.userData.ownGeo = true;
        smoke.userData.particleRadius = 0.08;
        scene.add(smoke);
        particles.push(smoke);
      }
    }

    const seg = cur.clone().sub(prev);
    const len = seg.length();
    if (len > 1e-5) {
      const dir = seg.clone().multiplyScalar(1 / len);
      raycaster.set(prev, dir);
      raycaster.far = len + 0.05;
      const hitsArena = raycaster.intersectObjects(arenaMeshes, false);
      if (hitsArena.length > 0) {
        const hp = hitsArena[0].point;
        if (p.type === 'rocket') explodeClassicRocket(p, hp, getWorldHitNormal(hitsArena[0]));
        else spawnBurnMark(hp, getWorldHitNormal(hitsArena[0]));
        scene.remove(p.mesh);
        if (p.mesh.geometry) p.mesh.geometry.dispose();
        if (p.mesh.material) p.mesh.material.dispose();
        classicProjectiles.splice(i, 1);
        continue;
      }
    }

    let hit = false;
    if (state.alive && !(p.owner && p.owner === 'player')) {
      const d2 = pointSegmentDistanceSq(playerObj.position, prev, cur);
      if (d2 <= (0.8 + p.radius) * (0.8 + p.radius)) {
        applyDamagePlayer(p.damage, p.owner || null);
        hit = true;
      }
    }
    if (!hit) {
      for (const b of bots) {
        if (!b || !b.alive) continue;
        if (p.owner === 'player') {
          const d2 = pointSegmentDistanceSq(b.mesh.position, prev, cur);
          if (d2 <= (0.9 + p.radius) * (0.9 + p.radius)) {
            applyDamageBot(b, p.damage, 'player');
            hit = true;
            break;
          }
        } else if (p.owner && p.owner !== b) {
          const d2 = pointSegmentDistanceSq(b.mesh.position, prev, cur);
          if (d2 <= (0.9 + p.radius) * (0.9 + p.radius)) {
            applyDamageBot(b, p.damage, p.owner);
            hit = true;
            break;
          }
        }
      }
    }
    if (hit) {
      if (p.type === 'rocket') explodeClassicRocket(p, cur);
      scene.remove(p.mesh);
      if (p.mesh.geometry) p.mesh.geometry.dispose();
      if (p.mesh.material) p.mesh.material.dispose();
      classicProjectiles.splice(i, 1);
    }
  }
  raycaster.far = Infinity;
}

window.__TA_IS_CLASSIC_RULESET = () => isClassicRuleset();
window.__TA_IS_INSTAGIB_PLUS_RULESET = () => isInstagibPlusRuleset();
window.__TA_TRY_INSTAGIB_SHIELD_BOT = (bot) => {
  if (!isInstagibPlusRuleset() || !bot || !(bot.shieldBelt > 0)) return false;
  bot.shieldBelt = 0;
  if (typeof sfxInstagibPlusShieldBreak === 'function') sfxInstagibPlusShieldBreak();
  return true;
};
window.__TA_APPLY_DAMAGE_PLAYER = applyDamagePlayer;
window.__TA_APPLY_DAMAGE_BOT = applyDamageBot;
window.__TA_CLASSIC_BOT_ITEM_TARGET = classicBestItemTargetForBot;
window.__TA_CLASSIC_BOT_TRY_PICKUP = tryClassicPickupForBot;
window.__TA_SPAWN_CLASSIC_PROJECTILE = spawnClassicProjectile;

function spawnInstagibPlusTntSplashFx(pos) {
  const p = pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y, pos.z);
  spawnInstagibKillExplosion(p, 0xff6622);
  spawnShockwave(p.clone(), 0xff8844, false);
  spawnShockwave(p.clone().add(new THREE.Vector3(0, 0.15, 0)), 0xffddaa, true);
}

/**
 * Instagib+: killing blow splashes while TNT buff is active. Splash does not chain.
 */
function maybeTriggerInstagibPlusTntSplash(killPos, killer, fromTntSplash) {
  if (fromTntSplash || !isInstagibPlusRuleset() || !roundActive) return;
  let hasTnt = false;
  if (killer === 'player') hasTnt = classicState.tntTimer > 0;
  else if (killer && killer.tntTimer > 0) hasTnt = true;
  if (!hasTnt) return;
  const R = INSTAGIB_PLUS_TNT_SPLASH_RADIUS;
  const R2 = R * R;
  const kx = killPos.x;
  const kz = killPos.z;
  spawnInstagibPlusTntSplashFx(killPos.clone ? killPos.clone() : new THREE.Vector3(killPos.x, killPos.y, killPos.z));
  const ctf = isCtfModeActive();

  for (const b of bots) {
    if (!b.alive) continue;
    if (killer !== 'player' && b === killer) continue;
    if (ctf && killer === 'player' && b.team === ctfState.playerTeam) continue;
    if (ctf && killer !== 'player' && killer.team && b.team && killer.team === b.team) continue;
    const bx = b.mesh.position.x;
    const bz = b.mesh.position.z;
    const dx = bx - kx;
    const dz = bz - kz;
    if (dx * dx + dz * dz > R2) continue;
    if (typeof window.__TA_TRY_INSTAGIB_SHIELD_BOT === 'function' && window.__TA_TRY_INSTAGIB_SHIELD_BOT(b)) continue;
    killBot(b, killer, true);
  }

  if (killer === 'player') return;

  if (state.alive && state.invincible <= 0) {
    const px = playerObj.position.x;
    const pz = playerObj.position.z;
    if ((px - kx) ** 2 + (pz - kz) ** 2 > R2) return;
    if (ctf && killer.team === ctfState.playerTeam) return;
    if (isInstagibPlusRuleset() && classicState.shieldBelt > 0) {
      classicState.shieldBelt = 0;
      hitFlash = Math.max(hitFlash, 0.14);
      if (typeof sfxInstagibPlusShieldBreak === 'function') sfxInstagibPlusShieldBreak();
      else sfxHit();
      return;
    }
    instagibPlayer(killer, true);
  }
}

// ── Damage system ─────────────────────────────────────────────────────────────
function instagibPlayer(attacker, fromTntSplash = false) {
  if (!state.alive) return;
  if (isCtfModeActive() && attacker && attacker.team === ctfState.playerTeam) return;
  if (isInstagibPlusRuleset() && attacker != null && classicState.shieldBelt > 0) {
    classicState.shieldBelt = 0;
    hitFlash = Math.max(hitFlash, 0.14);
    if (typeof sfxInstagibPlusShieldBreak === 'function') sfxInstagibPlusShieldBreak();
    else sfxHit();
    return;
  }
  const splashAt = playerObj.position.clone().add(new THREE.Vector3(0, 1, 0));
  if (isCtfModeActive()) {
    const enemyFlagTeam = ctfState.enemyTeam;
    const enemyFlag = getFlagState(enemyFlagTeam);
    if (enemyFlag.carrierType === 'player') dropFlag(enemyFlagTeam, playerObj.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
  }
  state.alive = false; state.deaths++;
  addProfileStat('deaths', 1);
  state.respawnTimer = 1.5;
  const lived = (performance.now() - lifeStart) / 1000;
  if (lived > longestLife) longestLife = lived;
  lifeStart = performance.now();
  sfxDeath();
  playDeathSound();
  deathscr.style.display = 'flex';
  if (deathTipEl) {
    if (!shownFirstDeathTip) {
      shownFirstDeathTip = true;
      deathTipEl.innerHTML = '<strong>Tip</strong> — Tab = scoreboard on/off · Esc = pause &amp; mouse sensitivity · dodge = double-tap WASD on the ground';
      deathTipEl.style.display = 'block';
    } else {
      deathTipEl.style.display = 'none';
    }
  }
  const pp = new THREE.Vector3(); camera.getWorldPosition(pp);
  spawnInstagibKillExplosion(pp, 0xff44cc);
  recordCombatHeat(playerObj.position.x, playerObj.position.z, 1.8);
  if (attacker) {
    attacker.kills++;
    if (attacker.mesh && attacker.mesh.position) recordCombatHeat(attacker.mesh.position.x, attacker.mesh.position.z, 1.0);
    const pkMeta = buildInstagibPlusKillMeta({
      killerIsPlayer: false,
      killerBot: attacker,
      fromTntSplash: false,
    });
    addKillFeedEntry(attacker.name, getPlayerName(), BOT_COLORS[attacker.colorIdx % BOT_COLORS.length].body, pkMeta);
    showKillMsg('KILLED BY ' + attacker.name.toUpperCase(), '#ff4444');
    if (Math.random() < 0.40) setTimeout(playRandomTaunt, 400 + Math.random() * 500);
  }
  multiKillCount = 0;
  spreeCount = 0;
  if (attacker && !fromTntSplash) maybeTriggerInstagibPlusTntSplash(splashAt, attacker, false);
}

function killBot(bot, killer, fromTntSplash = false) {
  if (isCtfModeActive()) {
    const flagBlue = getFlagState(TEAM_BLUE);
    const flagRed = getFlagState(TEAM_RED);
    if (flagBlue.carrierType === 'bot' && flagBlue.carrierRef === bot) dropFlag(TEAM_BLUE, bot.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
    if (flagRed.carrierType === 'bot' && flagRed.carrierRef === bot) dropFlag(TEAM_RED, bot.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
    if (killer && killer !== 'player' && killer.team && bot.team && killer.team === bot.team) return;
  }
  bot.alive = false; bot.mesh.visible = false;
  bot.respawnTimer = 1.5; bot.deaths++;
  const killPos = bot.mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
  spawnInstagibKillExplosion(killPos, BOT_COLORS[bot.colorIdx % BOT_COLORS.length].body);
  playDeathSound();
  recordCombatHeat(bot.mesh.position.x, bot.mesh.position.z, 1.6);

  const kfMeta = buildInstagibPlusKillMeta({
    killerIsPlayer: killer === 'player',
    killerBot: (killer && killer !== 'player' && killer !== bot) ? killer : null,
    fromTntSplash,
  });

  if (killer === 'player') {
    recordCombatHeat(playerObj.position.x, playerObj.position.z, 0.9);
    if (!isCtfModeActive()) state.kills++;
    killFlash = 0.05; hitFlash = 0.07;
    grantProfileXp(100);
    addProfileStat('kills', 1);
    shakePitch += (Math.random() - 0.5) * 0.015;
    shakeYaw += (Math.random() - 0.5) * 0.02;
    sfxKillConfirm();
    hitMarkerTimer = 0.22;
    hitMarkerEl.classList.remove('active');
    void hitMarkerEl.offsetWidth;
    hitMarkerEl.classList.add('active');
    addKillFeedEntry(getPlayerName(), bot.name, 0xff44cc, kfMeta);
    showKillMsg(getPlayerName().toUpperCase() + ' KILLED ' + bot.name.toUpperCase(), '#ff8833');
    multiKillCount++; multiKillTimer = 4;
    spreeCount++;
    checkKillStreaks();
  } else if (killer && killer !== bot) {
    killer.kills++;
    if (killer.mesh && killer.mesh.position) recordCombatHeat(killer.mesh.position.x, killer.mesh.position.z, 0.9);
    addKillFeedEntry(killer.name, bot.name, BOT_COLORS[killer.colorIdx % BOT_COLORS.length].body, kfMeta);
    if (Math.random() < 0.30) setTimeout(playRandomTaunt, 350 + Math.random() * 400);
  }
  if (!fromTntSplash) maybeTriggerInstagibPlusTntSplash(killPos, killer, false);
  
  // Update dynamic personality state for AI systems
  if (typeof updateBotDynamicState === 'function') {
    updateBotDynamicState(bot, { type: 'death', killer: killer });
    if (killer && killer !== 'player' && killer !== bot) {
      updateBotDynamicState(killer, { type: 'kill', victim: bot });
    }
  }
}

/** Multiplayer: server confirmed you fragged someone — match offline kill feedback (streaks, hit marker, flash). */
window.__TA_MP_ON_LOCAL_FRAG = function (victimName) {
  if (!window.__TA_MP_ACTIVE) return;
  grantProfileXp(100);
  addProfileStat('kills', 1);
  killFlash = 0.05;
  hitFlash = 0.07;
  shakePitch += (Math.random() - 0.5) * 0.015;
  shakeYaw += (Math.random() - 0.5) * 0.02;
  sfxKillConfirm();
  hitMarkerTimer = 0.22;
  if (hitMarkerEl) {
    hitMarkerEl.classList.remove('active');
    void hitMarkerEl.offsetWidth;
    hitMarkerEl.classList.add('active');
  }
  showKillMsg(getPlayerName().toUpperCase() + ' KILLED ' + String(victimName || '').toUpperCase(), '#ff8833');
  multiKillCount++;
  multiKillTimer = 4;
  spreeCount++;
  const sk = state.kills;
  state.kills = sk + 1;
  checkKillStreaks();
  state.kills = sk;
};

// ── Shooting ──────────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();

function tryDebugInteract(origin, dir) {
  if (currentMap !== DEBUG_MAP_IDX) return false;
  const pads = Array.isArray(window.__TA_DEBUG_SOUND_PADS) ? window.__TA_DEBUG_SOUND_PADS : [];
  if (!pads.length) return false;
  raycaster.set(origin, dir);
  raycaster.far = 120;
  const hits = raycaster.intersectObjects(pads, true);
  if (!hits.length) return false;
  const hit = hits[0].object;
  const key = hit.userData && hit.userData.debugSoundKey;
  if (!key) return false;
  if (typeof window.__TA_DEBUG_PLAY === 'function') {
    return !!window.__TA_DEBUG_PLAY(key);
  }
  return false;
}

function tryDebugBotEmote(origin, dir) {
  if (currentMap !== DEBUG_MAP_IDX) return false;
  const models = Array.isArray(window.__TA_DEBUG_DISPLAY_BOTS) ? window.__TA_DEBUG_DISPLAY_BOTS : [];
  if (!models.length) return false;
  raycaster.set(origin, dir);
  raycaster.far = 140;
  const hits = raycaster.intersectObjects(models, true);
  if (!hits.length) return false;
  let root = hits[0].object;
  while (root && root.parent && !root.userData?.debugDisplay && root.parent !== scene) root = root.parent;
  if (!root || !root.userData || !root.userData.debugDisplay) return false;
  // Easter eggs stay explicit; all other reactions try to use in-game clips.
  const roll = Math.random();
  const pick = roll < 0.12 ? 'wave' : (roll < 0.24 ? 'kiss' : 'random');
  if (typeof window.triggerDebugDisplayAnimation === 'function') {
    window.triggerDebugDisplayAnimation(root, pick);
  } else if (typeof window.triggerProceduralEmote === 'function') {
    window.triggerProceduralEmote(root, pick === 'random' ? 'taunt' : pick);
  }
  spawnBeam(origin, hits[0].point, INSTAGIB.beamColor, INSTAGIB.beamLife * 0.9);
  sfxHit();
  return true;
}

function triggerDebugLiquidEffect(mesh) {
  if (!mesh || !mesh.material) return;
  if (!mesh.userData.debugLiquidState) mesh.userData.debugLiquidState = { timer: 0, duration: 1.4, active: false };
  const st = mesh.userData.debugLiquidState;
  st.timer = st.duration || 1.4;
  st.active = true;
  if (!mesh.userData.debugLiquidBase) {
    mesh.userData.debugLiquidBase = {
      roughness: mesh.material.roughness ?? 0.5,
      metalness: mesh.material.metalness ?? 0.5,
      transparent: !!mesh.material.transparent,
      opacity: mesh.material.opacity ?? 1,
      emissive: mesh.material.emissive ? mesh.material.emissive.clone() : new THREE.Color(0x000000),
      emissiveIntensity: mesh.material.emissiveIntensity ?? 0,
    };
  }
}

function tryDebugLiquidHit(origin, dir) {
  if (currentMap !== DEBUG_MAP_IDX) return false;
  const targets = Array.isArray(window.__TA_DEBUG_LIQUID_TARGETS) ? window.__TA_DEBUG_LIQUID_TARGETS : [];
  if (!targets.length) return false;
  raycaster.set(origin, dir);
  raycaster.far = 140;
  const hits = raycaster.intersectObjects(targets, true);
  if (!hits.length) return false;
  const hitObj = hits[0].object;
  let root = hitObj;
  while (root && root.parent && !root.userData?.debugLiquidTarget && root.parent !== scene) root = root.parent;
  if (!root || !root.userData?.debugLiquidTarget) return false;
  triggerDebugLiquidEffect(root);
  spawnBeam(origin, hits[0].point, INSTAGIB.beamColor, INSTAGIB.beamLife * 0.9);
  sfxHit();
  return true;
}

function updateDebugLiquidTargets(dt) {
  if (currentMap !== DEBUG_MAP_IDX) return;
  const targets = Array.isArray(window.__TA_DEBUG_LIQUID_TARGETS) ? window.__TA_DEBUG_LIQUID_TARGETS : [];
  for (const mesh of targets) {
    if (!mesh || !mesh.userData || !mesh.userData.debugLiquidState || !mesh.material) continue;
    const st = mesh.userData.debugLiquidState;
    const base = mesh.userData.debugLiquidBase;
    if (!base) continue;
    if (st.timer > 0) {
      st.timer = Math.max(0, st.timer - dt);
      const t = st.duration > 0 ? (st.timer / st.duration) : 0;
      const pulse = Math.sin((1 - t) * Math.PI * 6) * (0.08 * t);
      mesh.scale.y = 1 - 0.18 * t + pulse;
      mesh.scale.x = 1 + 0.07 * t - pulse * 0.3;
      mesh.scale.z = 1 + 0.07 * t - pulse * 0.3;
      // Keep original color/texture readable; only add subtle wet shading.
      mesh.material.transparent = base.transparent;
      mesh.material.opacity = base.opacity;
      mesh.material.roughness = Math.max(0.05, base.roughness * (0.6 + 0.3 * (1 - t)));
      mesh.material.metalness = Math.min(1, base.metalness * 0.75);
      if (mesh.material.emissive) {
        mesh.material.emissive.copy(base.emissive).lerp(new THREE.Color(0x4fd5ff), 0.18);
        mesh.material.emissiveIntensity = Math.max(base.emissiveIntensity, 0.18 + (1 - t) * 0.12);
      }
      mesh.material.needsUpdate = true;
    } else if (st.active) {
      mesh.scale.set(1, 1, 1);
      mesh.material.transparent = base.transparent;
      mesh.material.opacity = base.opacity;
      mesh.material.roughness = base.roughness;
      mesh.material.metalness = base.metalness;
      if (mesh.material.emissive) {
        mesh.material.emissive.copy(base.emissive);
        mesh.material.emissiveIntensity = base.emissiveIntensity;
      }
      mesh.material.needsUpdate = true;
      st.active = false;
    }
  }
}

function playerShoot(isAltFire = false) {
  if (debugLevelMode || gamePaused || !state.alive || state.cooldown > 0 || !roundActive) return;
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  if (tryDebugLiquidHit(origin, dir)) {
    crosshairShootTimer = 0.09;
    return;
  }
  if (tryDebugBotEmote(origin, dir)) {
    crosshairShootTimer = 0.09;
    return;
  }
  if (tryDebugInteract(origin, dir)) {
    crosshairShootTimer = 0.09;
    return;
  }
  if (window.__TA_MP_ACTIVE) {
    addProfileStat('shots', 1);
    if (typeof window.__TA_MP_SEND_FIRE === 'function') {
      window.__TA_MP_SEND_FIRE({
        sdx: dir.x,
        sdy: dir.y,
        sdz: dir.z,
        sox: origin.x,
        soy: origin.y,
        soz: origin.z,
      });
    }
    playWeaponFire();
    spawnBeam(origin, origin.clone().addScaledVector(dir, INSTAGIB.range), INSTAGIB.beamColor, INSTAGIB.beamLife);
    raycaster.set(origin, dir); raycaster.far = INSTAGIB.range;
    const arenaHitsMp = raycaster.intersectObjects(arenaObjects.map(o => o.mesh), false);
    if (arenaHitsMp.length > 0) spawnBurnMark(arenaHitsMp[0].point, getWorldHitNormal(arenaHitsMp[0]));
    shakePitch += (Math.random() - 0.5) * 0.038;
    shakeYaw += (Math.random() - 0.5) * 0.032;
    crosshairShootTimer = 0.09;
    postShotMoveBiasTimer = 0.16;
    postShotStrafeDir = (keys.a || keys.arrowleft) ? -1 : ((keys.d || keys.arrowright) ? 1 : (Math.random() < 0.5 ? -1 : 1));
    return;
  }
  let beamLife = INSTAGIB.beamLife;
  let beamColor = INSTAGIB.beamColor;
  let fireRange = INSTAGIB.range;
  let damage = 9999;
  if (isClassicRuleset()) {
    const w = classicWeaponDef(classicState.activeWeapon);
    let need = w.cost;
    if (isAltFire) need = Math.max(1, w.cost + 1);
    const ammoNow = classicState.ammo[w.ammo] || 0;
    if (ammoNow < need) {
      showKillMsg('OUT OF AMMO', '#ff8a8a');
      return;
    }
    classicState.ammo[w.ammo] = Math.max(0, ammoNow - need);
    state.cooldown = w.cooldown * (isAltFire ? 1.16 : 1);
    fireRange = w.range;
    damage = Math.round(w.damage * (isAltFire ? 1.38 : 1));
    beamLife = 0.14;
    beamColor = w.beamColor;
    if (w.spread > 0) {
      const sp = w.spread * (isAltFire ? 1.6 : 1);
      dir.x += (Math.random() - 0.5) * sp;
      dir.y += (Math.random() - 0.5) * sp * 0.5;
      dir.z += (Math.random() - 0.5) * sp;
      dir.normalize();
    }
    if (classicState.uDamageTimer > 0) damage = Math.round(damage * 1.5);
    if (w.id === 'enforcer' || w.id === 'rocket') {
      shotsFired++;
      addProfileStat('shots', 1);
      playWeaponFire();
      shakePitch += (Math.random() - 0.5) * 0.026;
      shakeYaw += (Math.random() - 0.5) * 0.022;
      crosshairShootTimer = 0.08;
      spawnClassicProjectile(w.id === 'rocket' ? 'rocket' : 'bullet', origin, dir, 'player', damage);
      return;
    }
  } else {
    let cd = INSTAGIB.cooldown;
    if (isInstagibPlusRuleset() && classicState.uDamageTimer > 0) {
      cd *= 0.52;
      beamColor = 0xffcc66;
    } else if (isInstagibPlusRuleset() && classicState.tntTimer > 0) {
      beamColor = 0xff7744;
    }
    state.cooldown = cd;
  }
  shotsFired++;
  addProfileStat('shots', 1);
  playWeaponFire();

  shakePitch += (Math.random() - 0.5) * 0.038;
  shakeYaw += (Math.random() - 0.5) * 0.032;
  crosshairShootTimer = 0.09;
  postShotMoveBiasTimer = 0.16;
  postShotStrafeDir = (keys.a || keys.arrowleft) ? -1 : ((keys.d || keys.arrowright) ? 1 : (Math.random() < 0.5 ? -1 : 1));

  // Occasionally repick target (avoid everyone focusing the player — was too aggressive)
  const shootOrigin = new THREE.Vector3(); camera.getWorldPosition(shootOrigin);
  for (const b of bots) {
    if (!b.alive) continue;
    if (b.mesh.position.distanceTo(shootOrigin) < 42 && Math.random() < 0.07) {
      pickTarget(b);
      b.retargetTimer = 1.8 + Math.random() * 2.2;
    }
  }

  spawnBeam(origin, origin.clone().addScaledVector(dir, fireRange), beamColor, beamLife);

  raycaster.set(origin, dir); raycaster.far = fireRange;
  const arenaHits = raycaster.intersectObjects(arenaObjects.map(o => o.mesh), false);
  const hits = raycaster.intersectObjects(bots.filter(b => b.alive).map(b => b.mesh), true);
  const firstArena = arenaHits.length > 0 ? arenaHits[0] : null;
  const firstBot = hits.length > 0 ? hits[0] : null;
  if (firstArena && (!firstBot || firstArena.distance < firstBot.distance)) {
    spawnBurnMark(firstArena.point, getWorldHitNormal(firstArena));
  }
  if (hits.length > 0) {
    let root = hits[0].object;
    while (root.parent && root.parent !== scene) root = root.parent;
    const bot = bots.find(b => b.mesh === root);
    if (bot && bot.alive) {
      if (isCtfModeActive() && bot.team === ctfState.playerTeam) {
        raycaster.far = Infinity;
        return;
      }
      shotsHit++;
      addProfileStat('hits', 1);
      spawnBeam(origin, hits[0].point, beamColor, beamLife * 1.15);
      if (isClassicRuleset()) {
        sfxHit();
        applyDamageBot(bot, damage, 'player');
      } else if (typeof window.__TA_TRY_INSTAGIB_SHIELD_BOT === 'function' && window.__TA_TRY_INSTAGIB_SHIELD_BOT(bot)) {
        /* shield break SFX from __TA_TRY_INSTAGIB_SHIELD_BOT */
      } else {
        sfxHit();
        killBot(bot, 'player');
      }
    }
  }
  raycaster.far = Infinity;
}

// ── Collision ─────────────────────────────────────────────────────────────────
function resolveBoxCollision(pos, radius, height) {
  for (const o of arenaObjects) {
    const bp = o.mesh.position;
    const dx = pos.x - bp.x, dz = pos.z - bp.z, dy = pos.y - bp.y;
    const ox = o.hw + radius     - Math.abs(dx);
    const oz = o.hd + radius     - Math.abs(dz);
    const oy = o.hh + height * 0.5 - Math.abs(dy);
    if (ox > 0 && oz > 0 && oy > 0) {
      if      (ox < oz && ox < oy) pos.x += ox * Math.sign(dx);
      else if (oz < ox && oz < oy) pos.z += oz * Math.sign(dz);
      else { pos.y += oy * Math.sign(dy); if (dy > 0) return true; }
    }
  }
  return false;
}

const _pn = new THREE.Vector3();
const _pt = new THREE.Vector3();

/**
 * Bol vs axis-aligned box (arenaObjects). Past positie en snelheid aan: bounce + wrijving.
 */
function resolveSphereVsArenaBox(pos, vel, r, o, restitution = 0.36, friction = 0.22) {
  const c = o.mesh.position;
  const minX = c.x - o.hw, maxX = c.x + o.hw;
  const minY = c.y - o.hh, maxY = c.y + o.hh;
  const minZ = c.z - o.hd, maxZ = c.z + o.hd;

  const qx = Math.max(minX, Math.min(pos.x, maxX));
  const qy = Math.max(minY, Math.min(pos.y, maxY));
  const qz = Math.max(minZ, Math.min(pos.z, maxZ));

  let nx = pos.x - qx;
  let ny = pos.y - qy;
  let nz = pos.z - qz;
  const distSq = nx * nx + ny * ny + nz * nz;
  const r2 = r * r;
  if (distSq > r2) return false;

  if (distSq < 1e-14) {
    const px = pos.x - minX, px2 = maxX - pos.x;
    const py = pos.y - minY, py2 = maxY - pos.y;
    const pz = pos.z - minZ, pz2 = maxZ - pos.z;
    const cand = [px, px2, py, py2, pz, pz2];
    let mi = 0;
    for (let i = 1; i < 6; i++) if (cand[i] < cand[mi]) mi = i;
    const eps = 0.003;
    switch (mi) {
      case 0: pos.x = minX - r - eps; _pn.set(-1, 0, 0); break;
      case 1: pos.x = maxX + r + eps; _pn.set(1, 0, 0); break;
      case 2: pos.y = minY - r - eps; _pn.set(0, -1, 0); break;
      case 3: pos.y = maxY + r + eps; _pn.set(0, 1, 0); break;
      case 4: pos.z = minZ - r - eps; _pn.set(0, 0, -1); break;
      default: pos.z = maxZ + r + eps; _pn.set(0, 0, 1); break;
    }
    nx = _pn.x; ny = _pn.y; nz = _pn.z;
  } else {
    const dist = Math.sqrt(distSq);
    const pen = r - dist + 0.002;
    nx /= dist; ny /= dist; nz /= dist;
    pos.x += nx * pen;
    pos.y += ny * pen;
    pos.z += nz * pen;
  }

  const vn = vel.x * nx + vel.y * ny + vel.z * nz;
  if (vn >= -0.001) return true;
  const imp = (1 + restitution) * vn;
  vel.x -= imp * nx;
  vel.y -= imp * ny;
  vel.z -= imp * nz;
  const dot = vel.x * nx + vel.y * ny + vel.z * nz;
  _pt.set(vel.x - dot * nx, vel.y - dot * ny, vel.z - dot * nz);
  vel.x -= friction * _pt.x;
  vel.y -= friction * _pt.y;
  vel.z -= friction * _pt.z;
  return true;
}

/** Ground plane y=0 for maps without a thin floor in arenaObjects (not Morpheus). */
function resolveParticleGroundPlane(pos, vel, r, restitution = 0.38) {
  if (currentMap === 2) return;
  if (pos.y >= r) return;
  pos.y = r;
  if (vel.y < 0) {
    vel.y *= -restitution;
    vel.x *= 0.74;
    vel.z *= 0.74;
  }
}

function resolveExplosionParticleWithArena(pos, vel, r, passes = 3) {
  resolveParticleGroundPlane(pos, vel, r, 0.38);
  const rr = r * r;
  for (let pass = 0; pass < passes; pass++) {
    for (const o of arenaObjects) {
      const c = o.mesh.position;
      const qx = THREE.MathUtils.clamp(pos.x, c.x - o.hw, c.x + o.hw);
      const qy = THREE.MathUtils.clamp(pos.y, c.y - o.hh, c.y + o.hh);
      const qz = THREE.MathUtils.clamp(pos.z, c.z - o.hd, c.z + o.hd);
      const dx = pos.x - qx;
      const dy = pos.y - qy;
      const dz = pos.z - qz;
      if (dx * dx + dy * dy + dz * dz > rr * 1.0001) continue;
      resolveSphereVsArenaBox(pos, vel, r, o, 0.34, 0.24);
    }
  }
}

function supportYAt(x, z, aroundY, maxDrop = 9) {
  let best = 0;
  let found = false;
  for (const o of arenaObjects) {
    const c = o.mesh.position;
    if (Math.abs(x - c.x) > o.hw + 0.5) continue;
    if (Math.abs(z - c.z) > o.hd + 0.5) continue;
    const top = c.y + o.hh;
    if (top > aroundY + 0.7) continue;
    if (top < aroundY - maxDrop) continue;
    if (!found || top > best) { best = top; found = true; }
  }
  return found ? best : 0;
}

function updateContactShadows() {
  for (const sh of botContactShadows.values()) sh.visible = false;
  // Player grounding shadow.
  {
    const py = supportYAt(playerObj.position.x, playerObj.position.z, playerObj.position.y, 12);
    const h = Math.max(0, playerObj.position.y - py);
    const vis = Math.max(0, 1 - h / 7);
    playerContactShadow.visible = vis > 0.02 && state.alive;
    if (playerContactShadow.visible) {
      playerContactShadow.position.set(playerObj.position.x, py + 0.03, playerObj.position.z);
      const s = 1 + Math.min(1.2, h * 0.22);
      playerContactShadow.scale.set(s, s, s);
      playerContactShadow.material.opacity = 0.36 * vis;
    }
  }

  // Bot grounding shadows.
  for (const b of bots) {
    if (!b || !b.mesh || !b.alive || !b.mesh.visible) continue;
    let sh = botContactShadows.get(b);
    if (!sh) {
      sh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), CONTACT_SHADOW_MAT.clone());
      sh.rotation.x = -Math.PI * 0.5;
      sh.renderOrder = 3;
      scene.add(sh);
      botContactShadows.set(b, sh);
    }
    const by = supportYAt(b.mesh.position.x, b.mesh.position.z, b.mesh.position.y, 12);
    const h = Math.max(0, b.mesh.position.y - by);
    const vis = Math.max(0, 1 - h / 7.5);
    sh.visible = vis > 0.02;
    if (!sh.visible) continue;
    sh.position.set(b.mesh.position.x, by + 0.03, b.mesh.position.z);
    const s = 0.95 + Math.min(1.1, h * 0.2);
    sh.scale.set(s, s, s);
    sh.material.opacity = 0.3 * vis;
  }
}

// ── Player update ─────────────────────────────────────────────────────────────
const fwdVec = new THREE.Vector3(), rightVec = new THREE.Vector3();

function updatePlayer(dt) {
  if (window.__TA_MP_ACTIVE) return;

  if (debugLevelMode) {
    camera.getWorldDirection(fwdVec);
    fwdVec.normalize();
    rightVec.crossVectors(fwdVec, new THREE.Vector3(0, 1, 0)).normalize();
    const fly = new THREE.Vector3();
    if (keys.w || keys.arrowup) fly.addScaledVector(fwdVec, 1);
    if (keys.s || keys.arrowdown) fly.addScaledVector(fwdVec, -1);
    if (keys.d || keys.arrowright) fly.addScaledVector(rightVec, 1);
    if (keys.a || keys.arrowleft) fly.addScaledVector(rightVec, -1);
    if (keys[' ']) fly.y += 1;
    if (keys.control || keys.controlleft || keys.controlright || keys.c) fly.y -= 1;
    if (fly.lengthSq() > 0) {
      fly.normalize();
      const speed = (keys.shift || keys.shiftleft || keys.shiftright) ? 26 : 14;
      playerObj.position.addScaledVector(fly, speed * dt);
    }
    playerObj.position.x = Math.max(-MAP_BOUNDS[currentMap][0], Math.min(MAP_BOUNDS[currentMap][0], playerObj.position.x));
    playerObj.position.z = Math.max(-MAP_BOUNDS[currentMap][1], Math.min(MAP_BOUNDS[currentMap][1], playerObj.position.z));
    state.cooldown = 0;
    state.invincible = 999;
    onGround = false;
    return;
  }

  if (!state.alive) {
    state.respawnTimer -= dt;
    respawnTxt.textContent = `Respawn in ${Math.ceil(Math.max(0, state.respawnTimer))}...`;
    if (state.respawnTimer <= 0) {
      state.alive = true; state.invincible = 2;
      if (isClassicRuleset()) {
        resetClassicLoadout();
      } else if (isInstagibPlusRuleset()) {
        resetInstagibPlusState();
      }
      deathscr.style.display = 'none';
      const sp = pickSafePlayerSpawn();
      playerObj.position.set(sp[0], sp[1], sp[2]);
      velY = 0; onGround = false; dodgeVel.set(0, 0, 0); playerVelXZ.set(0, 0, 0);
    }
    return;
  }

  state.cooldown   = Math.max(0, state.cooldown - dt);
  state.invincible = Math.max(0, state.invincible - dt);
  dodgeCooldown    = Math.max(0, dodgeCooldown - dt);

  camera.getWorldDirection(fwdVec); fwdVec.y = 0; fwdVec.normalize();
  rightVec.crossVectors(fwdVec, new THREE.Vector3(0, 1, 0));

  const move = new THREE.Vector3();
  const wishDir = new THREE.Vector3();
  if (keys.w || keys.arrowup)    wishDir.addScaledVector(fwdVec, 1);
  if (keys.s || keys.arrowdown)  wishDir.addScaledVector(fwdVec, -1);
  if (keys.d || keys.arrowright) wishDir.addScaledVector(rightVec, 1);
  if (keys.a || keys.arrowleft)  wishDir.addScaledVector(rightVec, -1);
  if (wishDir.lengthSq() > 0) {
    wishDir.normalize();
    const accel = (onGround ? GROUND_ACCEL : AIR_ACCEL) * dt;
    playerVelXZ.addScaledVector(wishDir, accel);
    const maxSpeed = MOVE_SPEED * (onGround ? 1 : 0.9);
    const spd = Math.hypot(playerVelXZ.x, playerVelXZ.z);
    if (spd > maxSpeed) {
      const s = maxSpeed / Math.max(0.0001, spd);
      playerVelXZ.x *= s;
      playerVelXZ.z *= s;
    }
  } else if (onGround) {
    const damp = Math.max(0, 1 - GROUND_FRICTION * dt);
    playerVelXZ.multiplyScalar(damp);
  } else {
    playerVelXZ.multiplyScalar(Math.max(0, 1 - 1.8 * dt));
  }
  move.x = playerVelXZ.x * dt;
  move.z = playerVelXZ.z * dt;

  if (dodgeVel.lengthSq() > 0.01) {
    move.addScaledVector(dodgeVel, dt);
    dodgeVel.multiplyScalar(Math.max(0, 1 - 8 * dt));
  } else dodgeVel.set(0, 0, 0);

  if (postShotMoveBiasTimer > 0) {
    postShotMoveBiasTimer -= dt;
    const t = Math.max(0, postShotMoveBiasTimer / 0.16);
    playerVelXZ.addScaledVector(rightVec, postShotStrafeDir * (32 * t) * dt);
  }

  velY += GRAVITY * dt;
  move.y = velY * dt;
  playerObj.position.add(move);

  const wasInAir = !onGround;
  const landed   = resolveBoxCollision(playerObj.position, 0.45, PLAYER_H);
  if (currentMap !== 2 && playerObj.position.y <= PLAYER_H / 2) {
    playerObj.position.y = PLAYER_H / 2;
    if (velY < 0) {
      if (wasInAir && velY < -6) playLandSound(velY < -12);
      if (wasInAir && velY < -5) {
        const imp = -velY;
        landCamKick = -Math.min(0.12, (imp - 5) * 0.0055);
      }
      velY = 0; onGround = true; canDoubleJump = true;
    }
  } else {
    onGround = landed;
    if (landed && velY < 0) {
      if (wasInAir && velY < -4) playLandSound(velY < -10);
      if (wasInAir && velY < -5) {
        const imp = -velY;
        landCamKick = -Math.min(0.12, (imp - 5) * 0.0055);
      }
      velY = 0; canDoubleJump = true;
    }
  }
  if (currentMap === 2 && playerObj.position.y < -12 && state.alive) instagibPlayer(null);

  playerObj.position.x = Math.max(-MAP_BOUNDS[currentMap][0], Math.min(MAP_BOUNDS[currentMap][0], playerObj.position.x));
  playerObj.position.z = Math.max(-MAP_BOUNDS[currentMap][1], Math.min(MAP_BOUNDS[currentMap][1], playerObj.position.z));
}

// ── Visual update ─────────────────────────────────────────────────────────────
function updateVisuals(dt) {
  for (let i = beams.length - 1; i >= 0; i--) {
    const b = beams[i]; b.userData.life -= dt;
    const fade = Math.max(0, b.userData.life / b.userData.maxLife);
    b.material.opacity = fade * fade * 0.35 + fade * 0.65;
    if (b.userData.life <= 0) { scene.remove(b); b.geometry.dispose(); b.material.dispose(); beams.splice(i, 1); }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.userData.life -= dt;
    if (p.userData.isFlash) {
      const t  = 1 - p.userData.life / p.userData.maxLife;
      const sc = 1 + t * 10;
      p.scale.set(sc, sc, sc);
      p.material.opacity = Math.max(0, (1 - t * 1.5) * 0.95);
    } else if (p.userData.isDebris) {
      const r = p.userData.particleRadius ?? 0.08;
      p.userData.vel.y += GRAVITY * dt;
      p.userData.vel.multiplyScalar(Math.max(0.86, 1 - 0.85 * dt));
      p.position.addScaledVector(p.userData.vel, dt);
      resolveExplosionParticleWithArena(p.position, p.userData.vel, r, 3);
      p.rotation.x += p.userData.angVel.x * dt;
      p.rotation.y += p.userData.angVel.y * dt;
      p.rotation.z += p.userData.angVel.z * dt;
      p.userData.angVel.multiplyScalar(Math.max(0.92, 1 - 0.4 * dt));
      const op = Math.max(0, p.userData.life / p.userData.maxLife);
      const mats = p.material;
      if (mats && mats.opacity !== undefined) mats.opacity = op;
      else if (mats && mats.transparent) mats.opacity = op;
    } else if (p.userData.isSpark) {
      const r = p.userData.particleRadius ?? 0.04;
      p.userData.vel.y += GRAVITY * 0.22 * dt;
      p.position.addScaledVector(p.userData.vel, dt);
      resolveExplosionParticleWithArena(p.position, p.userData.vel, r, 2);
      p.userData.vel.multiplyScalar(Math.max(0.72, 1 - 2.8 * dt));
      p.material.opacity = Math.max(0, p.userData.life / p.userData.maxLife);
    } else if (p.userData.isChunk) {
      p.material.opacity = Math.max(0, p.userData.life / p.userData.maxLife);
      const r = p.userData.particleRadius ?? 0.1;
      p.userData.vel.y += GRAVITY * 0.65 * dt;
      p.position.addScaledVector(p.userData.vel, dt);
      resolveExplosionParticleWithArena(p.position, p.userData.vel, r, 3);
    } else {
      p.material.opacity = Math.max(0, p.userData.life / p.userData.maxLife);
      p.position.addScaledVector(p.userData.vel, dt);
      p.userData.vel.y += GRAVITY * 0.5 * dt;
    }
    if (p.userData.life <= 0) {
      scene.remove(p);
      if (p.userData.ownGeo) p.geometry.dispose();
      const mats = p.material;
      if (Array.isArray(mats)) mats.forEach(m => m.dispose());
      else if (mats) mats.dispose();
      particles.splice(i, 1);
    }
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s  = shockwaves[i]; s.userData.life -= dt;
    const t  = 1 - s.userData.life / s.userData.maxLife;
    const ex = s.userData.expandRate != null ? s.userData.expandRate : 12;
    const sc = 1 + t * ex;
    s.scale.set(sc, sc, sc);
    const baseOp = s.userData.maxLife < 0.3 ? 0.75 : 0.9;
    s.material.opacity = Math.max(0, (1 - t) * baseOp);
    if (s.userData.life <= 0) {
      scene.remove(s);
      if (s.userData.ownGeo) s.geometry.dispose();
      s.material.dispose();
      shockwaves.splice(i, 1);
    }
  }
  for (let i = burnMarks.length - 1; i >= 0; i--) {
    const b = burnMarks[i];
    b.userData.life -= dt;
    const f = Math.max(0, b.userData.life / b.userData.maxLife);
    b.material.opacity = f * 0.72;
    b.scale.multiplyScalar(0.994);
    if (b.userData.life <= 0) {
      scene.remove(b);
      b.geometry.dispose();
      b.material.dispose();
      burnMarks.splice(i, 1);
    }
  }
  if (killFlash > 0) killFlash -= dt;
  if (hitFlash > 0)  hitFlash  -= dt;
  if (msgTimer > 0)  { msgTimer -= dt; if (msgTimer <= 0) killmsg.style.opacity = '0'; }
  if (announcerTimer > 0) {
    announcerTimer -= dt;
    if (announcerTimer <= 0) announcerEl.style.opacity = '0';
    else if (announcerTimer < 0.28) announcerEl.style.opacity = String(announcerTimer / 0.28);
  }
  if (multiKillTimer > 0) { multiKillTimer -= dt; if (multiKillTimer <= 0) multiKillCount = 0; }
}

// ── HUD update ────────────────────────────────────────────────────────────────
function updateHud(dt) {
  const ctf = isCtfModeActive();
  if (hudScoreLabelEl) hudScoreLabelEl.textContent = ctf ? 'Caps' : 'Frags';
  fragsEl.textContent  = state.kills;
  deathsEl.textContent = state.deaths;
  if (isClassicRuleset()) {
    classicState.uDamageTimer = Math.max(0, classicState.uDamageTimer - dt);
    const w = classicWeaponDef(classicState.activeWeapon);
    if (weaponLabelEl) weaponLabelEl.textContent = w.name;
    if (weaponValueEl) {
      const ammo = classicState.ammo[w.ammo] || 0;
      const totalArmor = Math.max(0, Math.round((classicState.bodyArmor || 0) + (classicState.thighPads || 0) + (classicState.shieldBelt || 0)));
      weaponValueEl.textContent = `HP ${Math.max(0, Math.round(classicState.health))} | AR ${totalArmor} | ${ammo}${classicState.uDamageTimer > 0 ? ' | UDMG' : ''}`;
    }
    if (weaponBarEl) {
      weaponBarEl.style.display = 'flex';
      const slots = weaponBarEl.querySelectorAll('.weapon-slot');
      slots.forEach(slot => {
        const id = slot.getAttribute('data-weapon-id') || '';
        const unlocked = !!classicState.unlocked[id];
        slot.classList.toggle('locked', !unlocked);
        slot.classList.toggle('active', id === classicState.activeWeapon);
      });
    }
  } else if (isInstagibPlusRuleset()) {
    classicState.uDamageTimer = Math.max(0, classicState.uDamageTimer - dt);
    classicState.tntTimer = Math.max(0, classicState.tntTimer - dt);
    if (weaponLabelEl) weaponLabelEl.textContent = 'Enhanced Shock Rifle';
    if (weaponValueEl) {
      const parts = ['INSTAGIB+'];
      if (classicState.uDamageTimer > 0) parts.push('UDMG');
      if (classicState.tntTimer > 0) parts.push('TNT');
      if (classicState.shieldBelt > 0) parts.push(`SHIELD ${Math.round(classicState.shieldBelt)}`);
      weaponValueEl.textContent = parts.join(' · ');
    }
    if (weaponBarEl) weaponBarEl.style.display = 'none';
  } else {
    if (weaponLabelEl) weaponLabelEl.textContent = 'Enhanced Shock Rifle';
    if (weaponValueEl) weaponValueEl.textContent = 'INSTAGIB';
    if (weaponBarEl) weaponBarEl.style.display = 'none';
  }
  if (ctfStatusEl) {
    if (!ctf) {
      ctfStatusEl.style.display = 'none';
    } else {
      const ownFlag = getFlagState(ctfState.playerTeam);
      const enemyFlag = getFlagState(ctfState.enemyTeam);
      const ownState = ownFlag.atBase
        ? 'HOME'
        : (ownFlag.droppedPos ? `DROPPED ${Math.ceil(Math.max(0, ownFlag.resetTimer || 0))}S` : 'TAKEN');
      const enemyState = enemyFlag.carrierType === 'player'
        ? 'YOU HAVE IT'
        : (enemyFlag.atBase ? 'AT BASE' : (enemyFlag.droppedPos ? `DROPPED ${Math.ceil(Math.max(0, enemyFlag.resetTimer || 0))}S` : 'CARRIED'));
      ctfStatusEl.textContent = `Blue ${ctfState.playerScore} - Red ${ctfState.enemyScore}   |   Your flag: ${ownState}   |   Enemy flag: ${enemyState}${ctfState.overtime ? '   |   OVERTIME' : ''}`;
      ctfStatusEl.style.display = 'block';
    }
  }

  const sk = Math.exp(-dt * 24);
  shakePitch *= sk;
  shakeYaw *= sk;
  landCamKick += (0 - landCamKick) * Math.min(1, dt * 14);

  if (buffPickupFlashTimer > 0) {
    buffPickupFlashTimer -= dt;
    if (buffPickupFlashTimer <= 0) buffPickupFlashKind = '';
  }

  if (killFlash > 0)       renderer.domElement.style.filter = `brightness(${1 + killFlash * 2.1})`;
  else if (hitFlash > 0)   renderer.domElement.style.filter = `brightness(${1 + hitFlash * 1.35}) saturate(1.2)`;
  else if (buffPickupFlashTimer > 0 && buffPickupFlashKind) {
    const u = Math.min(1, buffPickupFlashTimer / 0.34);
    if (buffPickupFlashKind === 'udmg') {
      renderer.domElement.style.filter = `brightness(${1 + 0.14 * u}) saturate(${1 + 0.42 * u}) hue-rotate(${14 * u}deg)`;
    } else if (buffPickupFlashKind === 'tnt') {
      renderer.domElement.style.filter = `brightness(${1 + 0.17 * u}) sepia(${0.24 * u}) contrast(${1 + 0.11 * u})`;
    } else if (buffPickupFlashKind === 'shield') {
      renderer.domElement.style.filter = `brightness(${1 + 0.11 * u}) saturate(${1 + 0.48 * u})`;
    } else {
      renderer.domElement.style.filter = '';
    }
  } else                     renderer.domElement.style.filter = '';

  if (crosshairShootTimer > 0) crosshairShootTimer -= dt;
  if (profileToastEl) {
    if (profileToastTimer > 0) {
      profileToastTimer -= dt;
      profileToastEl.style.opacity = '1';
      profileToastEl.style.transform = 'translateY(0)';
    } else if (profileToastQueue.length) {
      profileToastEl.textContent = profileToastQueue.shift();
      profileToastTimer = 2.4;
      profileToastEl.style.opacity = '1';
      profileToastEl.style.transform = 'translateY(0)';
    } else {
      profileToastEl.style.opacity = '0';
      profileToastEl.style.transform = 'translateY(-6px)';
    }
  }
  if (hitMarkerTimer > 0) {
    hitMarkerTimer -= dt;
    const t = Math.max(0, hitMarkerTimer / 0.22);
    crosshairEl.style.transform = `translate(-50%, -50%) scale(${1 + t * 1.3})`;
    crosshairEl.style.filter    = `brightness(${1 + t * 3.2}) drop-shadow(0 0 ${(t * 8).toFixed(0)}px #fff) drop-shadow(0 0 8px #66ffcc)`;
  } else if (crosshairShootTimer > 0) {
    crosshairEl.style.transform = '';
    crosshairEl.style.filter    = 'brightness(1.32) drop-shadow(0 0 8px #ff66cc) drop-shadow(0 0 4px #ffaadd)';
  } else {
    crosshairEl.style.transform = '';
    crosshairEl.style.filter    = '';
  }

  updateMpRankHud();
}

// ── Input ─────────────────────────────────────────────────────────────────────
function checkDodge(key) {
  if (window.__TA_MP_ACTIVE) return;
  if (gamePaused || dodgeCooldown > 0 || !onGround || !state.alive || !roundActive) return;
  const now = performance.now() / 1000;
  if (lastTap[key] && now - lastTap[key] < DODGE_WINDOW) {
    let dir;
    if      (key === 'a') dir = rightVec.clone().negate();
    else if (key === 'd') dir = rightVec.clone();
    else if (key === 'w') dir = fwdVec.clone();
    else if (key === 's') dir = fwdVec.clone().negate();
    if (dir) {
      dodgeVel.copy(dir).multiplyScalar(DODGE_IMPULSE);
      playerVelXZ.addScaledVector(dir, 3.6);
      velY = Math.max(velY, 3.8);
      onGround = false;
      dodgeCooldown = 0.5;
      sfxDodge();
    }
    lastTap[key] = 0;
  } else lastTap[key] = now;
}

function pauseGame() {
  if (!started || gamePaused) return;
  for (const k in keys) keys[k] = false;
  gamePaused = true;
  showScoreboard = false;
  renderScoreboard();
  if (pauseOverlay) pauseOverlay.classList.add('is-open');
  document.querySelectorAll('[data-nick-input]').forEach(inp => { inp.value = localStorage.getItem(NICK_KEY) || ''; });
  document.exitPointerLock();
}

function resumeGame() {
  if (!gamePaused) return;
  gamePaused = false;
  if (pauseOverlay) pauseOverlay.classList.remove('is-open');
  document.body.requestPointerLock();
}

function quitMatchToMainMenu() {
  for (const k in keys) keys[k] = false;
  gamePaused = false;
  started = false;
  locked = false;
  showScoreboard = false;
  renderScoreboard();
  roundActive = false;
  intermissionTimer = 0;
  if (pauseOverlay) pauseOverlay.classList.remove('is-open');
  if (typeof deathscr !== 'undefined' && deathscr) deathscr.style.display = 'none';
  if (typeof roundEndEl !== 'undefined' && roundEndEl) roundEndEl.style.display = 'none';
  if (overlay) overlay.style.display = 'flex';
  try { document.exitPointerLock(); } catch (_) {}
  if (window.__TA_MP_ACTIVE && typeof window.__TA_MP_DISCONNECT === 'function') {
    window.__TA_MP_DISCONNECT();
  }
  const navSingle = document.getElementById('menu-nav-single');
  if (navSingle && !navSingle.disabled) navSingle.click();
  refreshMenuProfileName();
}

document.addEventListener('keydown', e => {
  if (debugLevelMode && started && !gamePaused) {
    const lower = e.key.toLowerCase();
    if (lower === 'h') {
      mapEditorState.showHint = !mapEditorState.showHint;
      updateEditorHud();
      e.preventDefault();
      return;
    }
    if (isMapEditorAllowed()) {
      if (lower === 'e') {
        placeEditorBoxInFront();
        e.preventDefault();
        return;
      }
      if (lower === 'q' || e.key === 'Delete' || e.key === 'Backspace') {
        removeEditorBoxByRay();
        e.preventDefault();
        return;
      }
      if (e.key === '[') {
        mapEditorState.sizeIdx = (mapEditorState.sizeIdx + EDITOR_SIZE_PRESETS.length - 1) % EDITOR_SIZE_PRESETS.length;
        updateEditorHud();
        e.preventDefault();
        return;
      }
      if (e.key === ']') {
        mapEditorState.sizeIdx = (mapEditorState.sizeIdx + 1) % EDITOR_SIZE_PRESETS.length;
        updateEditorHud();
        e.preventDefault();
        return;
      }
      if (lower === 'm') {
        mapEditorState.materialIdx = (mapEditorState.materialIdx + 1) % EDITOR_MATERIAL_PRESETS.length;
        updateEditorHud();
        e.preventDefault();
        return;
      }
      if (lower === 'r') {
        mapEditorState.rotateY += Math.PI / 12;
        updateEditorHud();
        e.preventDefault();
        return;
      }
      if (lower === 'k') {
        saveCurrentEditorSlot();
        e.preventDefault();
        return;
      }
      if (lower === 'l') {
        loadEditorSlot(getEditorActiveSlot(currentMap));
        e.preventDefault();
        return;
      }
      if (lower === 'n') {
        clearEditorSlot(getEditorActiveSlot(currentMap));
        e.preventDefault();
        return;
      }
      if (lower === 'o') {
        publishLocalMapFlow();
        e.preventDefault();
        return;
      }
      if (lower === 'j') {
        loadLocalMapFlow();
        e.preventDefault();
        return;
      }
      if (lower === 'u') {
        exportMapFlow();
        e.preventDefault();
        return;
      }
      if (lower === 'i') {
        importMapFlow();
        e.preventDefault();
        return;
      }
      if (lower === 'p') {
        restoreOriginalBuiltInMap();
        e.preventDefault();
        return;
      }
      if (lower === 'y') {
        if (typeof window.__TA_NAV_IS_TRAINING === 'function' && typeof window.__TA_NAV_SET_TRAINING === 'function') {
          const next = !window.__TA_NAV_IS_TRAINING();
          window.__TA_NAV_SET_TRAINING(next);
          if (next) {
            if (typeof window.__TA_SET_BOT_COUNT === 'function') {
              // Force high population during debug nav training for faster route coverage.
              window.__TA_SET_BOT_COUNT(11);
            }
            for (const b of bots) {
              if (!b || !b.mesh) continue;
              b.alive = true;
              b.mesh.visible = true;
              if (!Number.isFinite(b.mesh.position.y)) {
                const sp = randomSpawn();
                b.mesh.position.set(sp[0], sp[1], sp[2]);
              }
            }
            showKillMsg('AUTO-LEARN TRAINING ENABLED (11 BOTS)', '#8ee8ff');
          } else {
            for (const b of bots) {
              if (!b || !b.mesh) continue;
              b.alive = false;
              b.mesh.visible = false;
            }
            showKillMsg('AUTO-LEARN TRAINING DISABLED', '#ffd27a');
          }
          updateEditorHud();
        }
        e.preventDefault();
        return;
      }
      if (lower === 'z') {
        if (typeof window.__TA_NAV_IS_OVERLAY === 'function' && typeof window.__TA_NAV_SET_OVERLAY === 'function') {
          const next = !window.__TA_NAV_IS_OVERLAY();
          window.__TA_NAV_SET_OVERLAY(next);
          showKillMsg(next ? 'NAV OVERLAY ON' : 'NAV OVERLAY OFF', next ? '#8ee8ff' : '#ffd27a');
          updateEditorHud();
        }
        e.preventDefault();
        return;
      }
      if (lower === 'x') {
        const next = !heatmapState.overlayVisible;
        setHeatmapOverlayVisible(next);
        showKillMsg(next ? 'COMBAT HEATMAP OVERLAY ON' : 'COMBAT HEATMAP OVERLAY OFF', next ? '#8ee8ff' : '#ffd27a');
        updateEditorHud();
        e.preventDefault();
        return;
      }
      if (lower === 'b') {
        if (typeof window.__TA_NAV_BAKE_NOW === 'function') {
          const s = window.__TA_NAV_BAKE_NOW();
          if (s) showKillMsg(`NAV BAKED ${s.nodes}/${s.edges} (${s.completion || 0}%)`, '#8ee8ff');
          else showKillMsg('NAV BAKED', '#8ee8ff');
          updateEditorHud();
        }
        e.preventDefault();
        return;
      }
      if (e.key >= '1' && e.key <= '5') {
        loadEditorSlot(parseInt(e.key, 10));
        e.preventDefault();
        return;
      }
    }
  }
  if ((e.key === 'f' || e.key === 'F') && started) {
    e.preventDefault();
    copyScreenshotToClipboard().then(ok => {
      if (ok) showKillMsg('SCREENSHOT COPIED TO CLIPBOARD', '#66ccff');
      else showKillMsg('SCREENSHOT FAILED (CLIPBOARD BLOCKED)', '#ff6666');
    });
    return;
  }
  if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && started) {
    e.preventDefault();
    if (gamePaused) resumeGame();
    else pauseGame();
    return;
  }
  if (gamePaused) {
    if (e.key === 'Tab') e.preventDefault();
    return;
  }

  const k = e.key.toLowerCase();
  if (started && !debugLevelMode && isClassicRuleset()) {
    if (k === '1') classicState.activeWeapon = 'enforcer';
    if (k === '2' && classicState.unlocked.shock) classicState.activeWeapon = 'shock';
    if (k === '3' && classicState.unlocked.rocket) classicState.activeWeapon = 'rocket';
  }
  if (!keys[k]) checkDodge(k);
  keys[k] = true;
  if ((e.key === ' ' || e.key === 'Spacebar') && started && roundActive && state.alive) {
    if (window.__TA_MP_ACTIVE) {
      e.preventDefault();
      return;
    }
    if (onGround) { velY = JUMP_SPEED; onGround = false; playJumpSound(); }
    else if (ENABLE_DOUBLE_JUMP && canDoubleJump) { velY = JUMP_SPEED * 0.85; canDoubleJump = false; playJumpSound(); }
    e.preventDefault();
  }
  if (e.key === 'Tab' && started) {
    if (e.repeat) { e.preventDefault(); return; }
    showScoreboard = !showScoreboard;
    renderScoreboard();
    playMenuSelect(false);
    e.preventDefault();
  }
  if ((e.key === 'g' || e.key === 'G') && isCtfModeActive()) {
    const enemyFlagTeam = ctfState.enemyTeam;
    const st = getFlagState(enemyFlagTeam);
    if (st.carrierType === 'player') {
      dropFlag(enemyFlagTeam, playerObj.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
      showKillMsg('FLAG DROPPED', '#ffb888');
      e.preventDefault();
    }
  }
});

document.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
});

document.addEventListener('mousemove', e => {
  if (!locked || !started || gamePaused) return;
  yaw   -= e.movementX * MOUSE_BASE_X * mouseSensitivity;
  pitch -= e.movementY * MOUSE_BASE_Y * mouseSensitivity;
  pitch  = Math.max(-1.4, Math.min(1.4, pitch));
});

document.addEventListener('mousedown', e => {
  if (!started || !locked || gamePaused) return;
  if (e.button === 0) playerShoot(false);
  else if (e.button === 2 && isClassicRuleset()) playerShoot(true);
});
document.addEventListener('contextmenu', e => {
  if (started && locked && isClassicRuleset()) e.preventDefault();
});
document.addEventListener('wheel', e => {
  if (!started || gamePaused || !isClassicRuleset()) return;
  const avail = ['enforcer'];
  if (classicState.unlocked.shock) avail.push('shock');
  if (classicState.unlocked.rocket) avail.push('rocket');
  let idx = avail.indexOf(classicState.activeWeapon);
  if (idx < 0) idx = 0;
  idx = (idx + (e.deltaY > 0 ? 1 : -1) + avail.length) % avail.length;
  classicState.activeWeapon = avail[idx];
  e.preventDefault();
}, { passive: false });

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === document.body;
  if (locked) {
    clearTimeout(pointerLockLossTimer);
    return;
  }
  // Losing pointer lock is normal (browser policy, Alt+Tab, focus). Open pause — not the main menu.
  if (!started || gamePaused) return;
  clearTimeout(pointerLockLossTimer);
  pointerLockLossTimer = setTimeout(() => {
    if (document.pointerLockElement === document.body) return;
    if (started && !gamePaused) pauseGame();
  }, 300);
});

if (sensSlider && sensVal) {
  sensSlider.addEventListener('input', () => {
    mouseSensitivity = parseFloat(sensSlider.value);
    sensVal.textContent = mouseSensitivity.toFixed(2) + '×';
    try { localStorage.setItem('ta_mouseSens', String(mouseSensitivity)); } catch (_) {}
  });
}
if (resumebtn) resumebtn.addEventListener('click', () => resumeGame());
if (quitmatchbtn) quitmatchbtn.addEventListener('click', () => quitMatchToMainMenu());

function launchSingleplayer() {
  debugLevelMode = false;
  if (window.__TA_MP_ACTIVE && typeof window.__TA_MP_DISCONNECT === 'function') {
    window.__TA_MP_DISCONNECT();
  }
  window.__TA_MP_ACTIVE = false;
  window.__TA_MP_FORCE_CONNECT = false;
  window.__TA_MP_FORCE_URL = '';
  applySingleplayerLobbySettings();
  started = true;
  overlay.style.display = 'none';
  document.body.requestPointerLock();
  ensureAudio();
  playMenuSelect(true);
  loadAllSounds();
  const mode = window.__TA_MENU_MODE || 'single';
  if (mode === 'debug') {
    spRoundDurationSec = 36000;
    if (typeof window.__TA_SET_BOT_COUNT === 'function') window.__TA_SET_BOT_COUNT(0);
    startNewRound(DEBUG_MAP_IDX);
  } else {
    const target = spGameMode === 'ctf' ? spSelectedCtfMapIdx : spSelectedMapIdx;
    startNewRound(target);
  }
  updateEditorHud();
}

if (startbtnSp) startbtnSp.addEventListener('click', launchSingleplayer);

function launchDebugRoom() {
  debugLevelMode = false;
  window.__TA_MENU_MODE = 'debug';
  launchSingleplayer();
}

function launchDebugLevelMode(mapIdx = 0) {
  debugLevelMode = true;
  window.__TA_MENU_MODE = 'debug-levels';
  window.__TA_MP_FORCE_CONNECT = false;
  window.__TA_MP_FORCE_URL = '';
  started = true;
  overlay.style.display = 'none';
  document.body.requestPointerLock();
  ensureAudio();
  playMenuSelect(true);
  loadAllSounds();
  spRoundDurationSec = 36000;
  if (typeof window.__TA_SET_BOT_COUNT === 'function') window.__TA_SET_BOT_COUNT(0);
  const targetMap = Math.max(0, Math.min(NORMAL_MAP_COUNT - 1, mapIdx | 0));
  startNewRound(targetMap);
  loadEditorSlot(getEditorActiveSlot(targetMap), false);
  if (typeof window.__TA_NAV_SET_TRAINING === 'function') window.__TA_NAV_SET_TRAINING(false);
  // Exploration mode: hide/disable any existing bots.
  for (const b of bots) {
    b.alive = false;
    if (b.mesh) b.mesh.visible = false;
  }
  updateEditorHud();
}

function startMultiplayerRound() {
  roundEndEl.style.display = 'none';
  currentMap = 0;
  rebuildArenaForCurrentMap();
  state.alive = true;
  state.cooldown = 0;
  state.invincible = 3;
  state.kills = 0;
  state.deaths = 0;
  deathscr.style.display = 'none';
  roundActive = true;
  roundTimer = spRoundDurationSec;
  killFeedEntries.length = 0;
  renderKillFeed();
  showKillMsg(MAP_NAMES[0], '#ff9944');
}

window.__TA_GET_INPUT = () => ({ keys, yaw, pitch });

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

refreshMenuLbHint();
bindNicknameInputs();
initMainMenuShell();
readUserMapEditorData();

function applyCameraView() {
  camera.rotation.x = pitch + shakePitch;
  playerObj.rotation.y = yaw + shakeYaw;
  camera.position.y = CAM_HEIGHT + landCamKick;
}

// ── Game loop ─────────────────────────────────────────────────────────────────
let last = 0;
function animate(ts) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
  last = ts;

  if (started && !gamePaused) {
    updateRound(dt);
    if (roundActive) {
      if (window.__TA_MP_ACTIVE) {
        if (typeof window.__TA_MP_TICK === 'function') window.__TA_MP_TICK(dt);
      } else {
        updatePlayer(dt);
        updateClassicItems(dt);
        updateClassicProjectiles(dt);
        const navTraining = (typeof window.__TA_NAV_IS_TRAINING === 'function') ? !!window.__TA_NAV_IS_TRAINING() : false;
        if (!debugLevelMode || navTraining) updateBots(dt);
      }
      updateContactShadows();
    }
    updateKillFeed(dt);
  }
  updateVisuals(dt);
  updateDebugLiquidTargets(dt);
  if (currentMap === DEBUG_MAP_IDX && typeof window.applyProceduralPoseToMesh === 'function') {
    const displayBots = Array.isArray(window.__TA_DEBUG_DISPLAY_BOTS) ? window.__TA_DEBUG_DISPLAY_BOTS : [];
    for (const m of displayBots) {
      if (!m) continue;
      const mixer = m.userData && m.userData.debugAnimMixer;
      if (mixer) {
        mixer.update(dt);
        const ret = m.userData.debugAnimReturn;
        if (ret && ret.idleClip) {
          ret.timer -= dt;
          if (ret.timer <= 0) {
            m.userData.debugAnimReturn = null;
            mixer.stopAllAction();
            const idle = mixer.clipAction(ret.idleClip);
            idle.reset();
            idle.setLoop(THREE.LoopRepeat, Infinity);
            idle.play();
          }
        }
      } else {
        window.applyProceduralPoseToMesh(m, dt, 0.2, true, true);
      }
    }
  }
  updateHud(dt);
  updateEditorHud();
  if (currentMap === DEBUG_MAP_IDX && typeof window.__TA_DEBUG_UPDATE_PANELS === 'function') {
    const fps = dt > 0 ? Math.round(1 / dt) : 0;
    const acc = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;
    const pos = `${playerObj.position.x.toFixed(1)}, ${playerObj.position.y.toFixed(1)}, ${playerObj.position.z.toFixed(1)}`;
    const ang = `${(yaw * 57.3).toFixed(1)} / ${(pitch * 57.3).toFixed(1)}`;
    const r = renderer.info && renderer.info.render ? renderer.info.render : {};
    const totalBots = Array.isArray(window.bots) ? window.bots.length : (Array.isArray(bots) ? bots.length : 0);
    const aliveBots = Array.isArray(window.bots)
      ? window.bots.filter(b => b && b.alive).length
      : (Array.isArray(bots) ? bots.filter(b => b && b.alive).length : 0);
    window.__TA_DEBUG_UPDATE_PANELS({
      fps,
      dtMs: Math.round(dt * 1000 * 10) / 10,
      drawCalls: r.calls ?? '-',
      triangles: r.triangles ?? '-',
      lines: r.lines ?? '-',
      points: r.points ?? '-',
      particles: typeof particles !== 'undefined' && particles ? particles.length : 0,
      beams: typeof beams !== 'undefined' && beams ? beams.length : 0,
      kills: lastCompletedMatchStats.playerKills,
      deaths: lastCompletedMatchStats.playerDeaths,
      accuracy: `${lastCompletedMatchStats.accuracyPct}%`,
      shotsFired: lastCompletedMatchStats.shotsFired,
      shotsHit: lastCompletedMatchStats.shotsHit,
      bestSpree: lastCompletedMatchStats.bestSpree,
      alive: state.alive,
      invincible: state.invincible.toFixed ? state.invincible.toFixed(2) : state.invincible,
      cooldown: state.cooldown.toFixed ? state.cooldown.toFixed(2) : state.cooldown,
      pos,
      angles: ang,
      roundActive,
      roundTimerText: formatTime(roundTimer),
      mapName: MAP_NAMES[currentMap],
      menuMode: window.__TA_MENU_MODE || 'single',
      paused: gamePaused,
      mpActive: !!window.__TA_MP_ACTIVE,
      mpSlot: window.__TA_MP_STATE && window.__TA_MP_STATE.slot,
      totalBots,
      aliveBots,
      resolution: `${Math.round(innerWidth)}x${Math.round(innerHeight)}`,
      matchMode: lastCompletedMatchStats.mode,
      matchReason: lastCompletedMatchStats.reason,
      matchWinner: lastCompletedMatchStats.winner,
      matchEndedAt: lastCompletedMatchStats.endedAt,
      longestLifeText: lastCompletedMatchStats.longestLifeText,
      matchScoreLines: Array.isArray(lastCompletedMatchStats.scoreLines) ? lastCompletedMatchStats.scoreLines : [],
    });
  }
  applyCameraView();
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
