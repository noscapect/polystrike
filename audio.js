// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO — synthesizers + UT99 sound files
// ═══════════════════════════════════════════════════════════════════════════════

let audioCtx = null;
let masterGain = null;
let stereoPathGain = null;
let monoPathGain = null;
let monoSplitter = null;
let monoGainL = null;
let monoGainR = null;
let monoSum = null;
let monoMerger = null;
let audioVolume = 1;
let audioMode = 'stereo';

const AUDIO_VOL_KEY = 'ta_audioVolume';
const AUDIO_MODE_KEY = 'ta_audioMode';

try {
  const sv = parseFloat(localStorage.getItem(AUDIO_VOL_KEY));
  if (!Number.isNaN(sv)) audioVolume = Math.max(0, Math.min(1, sv));
  const sm = (localStorage.getItem(AUDIO_MODE_KEY) || '').toLowerCase();
  if (sm === 'mono' || sm === 'stereo') audioMode = sm;
} catch (_) {}

function setupAudioGraph(ctx) {
  if (masterGain) return;
  masterGain = ctx.createGain();
  masterGain.gain.value = audioVolume;

  stereoPathGain = ctx.createGain();
  monoPathGain = ctx.createGain();
  monoPathGain.gain.value = 0;
  stereoPathGain.gain.value = 1;

  monoSplitter = ctx.createChannelSplitter(2);
  monoGainL = ctx.createGain();
  monoGainR = ctx.createGain();
  monoGainL.gain.value = 0.5;
  monoGainR.gain.value = 0.5;
  monoSum = ctx.createGain();
  monoMerger = ctx.createChannelMerger(2);

  masterGain.connect(stereoPathGain);
  stereoPathGain.connect(ctx.destination);

  masterGain.connect(monoSplitter);
  monoSplitter.connect(monoGainL, 0);
  monoSplitter.connect(monoGainR, 1);
  monoGainL.connect(monoSum);
  monoGainR.connect(monoSum);
  monoSum.connect(monoMerger, 0, 0);
  monoSum.connect(monoMerger, 0, 1);
  monoMerger.connect(monoPathGain);
  monoPathGain.connect(ctx.destination);

  applyAudioSettings({ volume: audioVolume, mode: audioMode });
}

function outputNode(ctx) {
  setupAudioGraph(ctx);
  return masterGain;
}

function applyAudioSettings(opts) {
  if (opts && typeof opts === 'object') {
    if (opts.volume != null) {
      const v = Number(opts.volume);
      if (Number.isFinite(v)) audioVolume = Math.max(0, Math.min(1, v));
    }
    if (opts.mode != null) {
      const m = String(opts.mode).toLowerCase();
      if (m === 'mono' || m === 'stereo') audioMode = m;
    }
  }
  try {
    localStorage.setItem(AUDIO_VOL_KEY, String(audioVolume));
    localStorage.setItem(AUDIO_MODE_KEY, audioMode);
  } catch (_) {}
  if (masterGain) masterGain.gain.setValueAtTime(audioVolume, audioCtx.currentTime);
  if (stereoPathGain && monoPathGain) {
    const stereoOn = audioMode === 'stereo';
    stereoPathGain.gain.setValueAtTime(stereoOn ? 1 : 0, audioCtx.currentTime);
    monoPathGain.gain.setValueAtTime(stereoOn ? 0 : 1, audioCtx.currentTime);
  }
}

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  setupAudioGraph(audioCtx);
  return audioCtx;
}

// ── Synthesizer primitives ────────────────────────────────────────────────────

function synth(dur, freq, vol, type = "sawtooth", fF = 4000, fQ = 1, det = 0) {
  const ctx = ensureAudio(), now = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = type; o.frequency.setValueAtTime(freq, now);
  if (det) o.detune.setValueAtTime(det, now);
  f.type = "lowpass"; f.frequency.setValueAtTime(fF, now); f.Q.setValueAtTime(fQ, now);
  g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  o.connect(f); f.connect(g); g.connect(outputNode(ctx));
  o.start(now); o.stop(now + dur);
}

function noiseBurst(dur, vol, fF = 3000, fQ = 2) {
  const ctx = ensureAudio(), now = ctx.currentTime;
  const len = ctx.sampleRate * dur;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
  const s = ctx.createBufferSource(); s.buffer = buf;
  const g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = "bandpass"; f.frequency.value = fF; f.Q.value = fQ;
  g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  s.connect(f); f.connect(g); g.connect(outputNode(ctx));
  s.start(now); s.stop(now + dur);
}

// ── Procedural SFX (fallback when WAV files are missing) ─────────────────────

/** Same procedural mix as player; `volMul` scales everything (distance / mix). */
function sfxShoot(volMul = 1) {
  const v = Math.max(0, Math.min(1, volMul));
  const ctx = ensureAudio(), now = ctx.currentTime;
  const crack = ctx.createOscillator(), crackGain = ctx.createGain();
  crack.type = "sawtooth";
  crack.frequency.setValueAtTime(3200, now);
  crack.frequency.exponentialRampToValueAtTime(120, now + 0.12);
  crackGain.gain.setValueAtTime(0.22 * v, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  crack.connect(crackGain); crackGain.connect(outputNode(ctx));
  crack.start(now); crack.stop(now + 0.12);
  synth(0.11, 140, 0.16 * v, "square", 650, 2.4, -20);
  synth(0.07, 90, 0.14 * v, "sawtooth", 420, 2.8, -50);
  noiseBurst(0.06, 0.2 * v, 2200, 2.4);
}

function sfxKillConfirm() {
  const ctx = ensureAudio(), now = ctx.currentTime;
  const crack = ctx.createOscillator(), crackG = ctx.createGain();
  crack.type = "sawtooth";
  crack.frequency.setValueAtTime(4200, now);
  crack.frequency.exponentialRampToValueAtTime(140, now + 0.09);
  crackG.gain.setValueAtTime(0.30, now);
  crackG.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  crack.connect(crackG); crackG.connect(outputNode(ctx));
  crack.start(now); crack.stop(now + 0.09);
  synth(0.24, 78, 0.35, "sawtooth", 260, 3.8);
  noiseBurst(0.10, 0.22, 550, 1.6);
  const sweep = ctx.createOscillator(), sweepG = ctx.createGain();
  sweep.type = "square";
  sweep.frequency.setValueAtTime(210, now + 0.07);
  sweep.frequency.exponentialRampToValueAtTime(920, now + 0.26);
  sweepG.gain.setValueAtTime(0, now + 0.07);
  sweepG.gain.linearRampToValueAtTime(0.13, now + 0.11);
  sweepG.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
  sweep.connect(sweepG); sweepG.connect(outputNode(ctx));
  sweep.start(now + 0.07); sweep.stop(now + 0.32);
}

function sfxDeath() {
  synth(0.5, 95, 0.24, "sawtooth", 520, 3.2);
  synth(0.28, 180, 0.15, "square", 420, 2.4, -70);
  noiseBurst(0.11, 0.13, 700, 1.1);
}

function sfxHit() {
  synth(0.055, 1800, 0.12, "square", 5200, 0.85);
  synth(0.03, 420, 0.07, "sawtooth", 900, 1.8);
  noiseBurst(0.035, 0.1, 4200, 2.8);
}

/** Instagib+ UDamage pickup — bright power rise */
function sfxInstagibPlusPickupUdmg() {
  const ctx = ensureAudio(), now = ctx.currentTime;
  [330, 440, 550].forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, now + i * 0.045);
    g.gain.setValueAtTime(0, now + i * 0.045);
    g.gain.linearRampToValueAtTime(0.11, now + i * 0.045 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.18);
    o.connect(g); g.connect(outputNode(ctx));
    o.start(now + i * 0.045); o.stop(now + i * 0.045 + 0.2);
  });
  synth(0.14, 220, 0.06, 'sawtooth', 1200, 2.2);
}

/** Instagib+ TNT pickup — fuse hiss + tick */
function sfxInstagibPlusPickupTnt() {
  const ctx = ensureAudio(), now = ctx.currentTime;
  noiseBurst(0.08, 0.14, 1800, 1.4);
  synth(0.05, 95, 0.1, 'square', 600, 1.2);
  for (let i = 0; i < 4; i++) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(880 + i * 120, now + i * 0.04);
    g.gain.setValueAtTime(0.07, now + i * 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.05);
    o.connect(g); g.connect(outputNode(ctx));
    o.start(now + i * 0.04); o.stop(now + i * 0.04 + 0.06);
  }
}

/** Instagib+ Shield belt pickup — energy coat */
function sfxInstagibPlusPickupShield() {
  synth(0.2, 140, 0.12, 'sawtooth', 900, 2.8);
  synth(0.12, 420, 0.08, 'sine', 2400, 1.2);
  noiseBurst(0.06, 0.09, 3500, 2.2);
}

/** Instagib+ Shield absorbed a hit — crack + ring-off */
function sfxInstagibPlusShieldBreak() {
  const ctx = ensureAudio(), now = ctx.currentTime;
  noiseBurst(0.07, 0.16, 4200, 3.5);
  synth(0.05, 2400, 0.1, 'square', 8000, 0.9);
  synth(0.12, 180, 0.14, 'sawtooth', 1400, 2.4);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(520, now);
  o.frequency.exponentialRampToValueAtTime(90, now + 0.14);
  g.gain.setValueAtTime(0.12, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  o.connect(g); g.connect(outputNode(ctx));
  o.start(now); o.stop(now + 0.17);
}

function sfxDodge() {
  noiseBurst(0.06, 0.09, 1500, 1.3);
  synth(0.05, 220, 0.07, "sawtooth", 1200, 0.8);
}

function sfxCountdownBeep(final) {
  synth(final ? 0.22 : 0.1, final ? 520 : 300, 0.1, "square", 2500, 1.2);
}

function sfxRoundStart() {
  const ctx = ensureAudio(), now = ctx.currentTime;
  [180, 240, 300].forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "square"; o.frequency.value = f;
    g.gain.setValueAtTime(0.09, now + i * 0.07);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.16);
    o.connect(g); g.connect(outputNode(ctx));
    o.start(now + i * 0.07); o.stop(now + i * 0.07 + 0.16);
  });
}

function sfxRoundEnd() {
  const ctx = ensureAudio(), now = ctx.currentTime;
  [300, 240, 180, 130].forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "square"; o.frequency.value = f;
    g.gain.setValueAtTime(0.08, now + i * 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.2);
    o.connect(g); g.connect(outputNode(ctx));
    o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.2);
  });
}

function sfxAnnounce(type) {
  const ctx = ensureAudio(), now = ctx.currentTime;
  const chord = (freqs, wave, vol, spacing, dur) => {
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = wave; o.frequency.value = f;
      g.gain.setValueAtTime(vol, now + i * spacing);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * spacing + dur);
      o.connect(g); g.connect(outputNode(ctx));
      o.start(now + i * spacing); o.stop(now + i * spacing + dur);
    });
  };
  switch (type) {
    case "double":      chord([260, 340], "square", 0.11, 0.06, 0.14); break;
    case "multi":       chord([220, 300, 380], "square", 0.11, 0.05, 0.14); break;
    case "ultra":       chord([190, 260, 330, 420], "sawtooth", 0.11, 0.045, 0.15); break;
    case "monster":     chord([90, 120, 160, 220, 300], "sawtooth", 0.1, 0, 0.45); break;
    case "firstblood":
      synth(0.38, 95, 0.16, "sawtooth", 650, 2.4);
      synth(0.2, 180, 0.11, "square", 450, 1.8);
      break;
    case "spree":       chord([160, 220, 300], "square", 0.1, 0.07, 0.2); break;
    case "rampage":     chord([140, 190, 260, 340], "sawtooth", 0.1, 0.06, 0.2); break;
    case "dominating":  chord([120, 160, 220, 300, 420], "square", 0.095, 0.04, 0.32); break;
    case "unstoppable": chord([110, 150, 200, 280, 380], "sawtooth", 0.1, 0.035, 0.35); break;
    case "godlike":     chord([80, 110, 150, 200, 280, 380, 520], "sawtooth", 0.09, 0.028, 0.45); break;
  }
}

// ── UT99 audio files ───────────────────────────────────────────────────────────

const ANNOUNCER_FILES = {
  double: 'audio/announcer/doublekill.wav',  multi:  'audio/announcer/triplekill.wav',
  ultra:  'audio/announcer/multikill.wav',   monster: 'audio/announcer/monsterkill.wav',
  firstblood: 'audio/announcer/firstblood.wav',
  spree: 'audio/announcer/killingspree.wav', rampage: 'audio/announcer/rampage.wav',
  dominating: 'audio/announcer/dominating.wav', unstoppable: 'audio/announcer/unstoppable.wav',
  godlike: 'audio/announcer/godlike.wav',
  roundstart: 'audio/announcer/prepare.wav', roundwin: 'audio/announcer/winner.wav',
  roundlose:  'audio/announcer/lostmatch.wav',
  cd1: 'audio/announcer/cd1.wav',   cd2: 'audio/announcer/cd2.wav',
  cd3: 'audio/announcer/cd3.wav',   cd4: 'audio/announcer/cd4.wav',
  cd5: 'audio/announcer/cd5.wav',   cd6: 'audio/announcer/cd6.wav',
  cd7: 'audio/announcer/cd7.wav',   cd8: 'audio/announcer/cd8.wav',
  cd9: 'audio/announcer/cd9.wav',   cd10: 'audio/announcer/cd10.wav',
  cd1min: 'audio/announcer/cd1min.wav', cd30sec: 'audio/announcer/cd30sec.wav',
};

const WEAPON_FILES = { shock_fire: 'audio/weapons/shock_fire.wav' };

const CHAR_FILES = {
  jump: 'audio/character/jump.wav', land: 'audio/character/land.wav',
  death1: 'audio/character/death_1.wav', death3: 'audio/character/death_3.wav',
  death4: 'audio/character/death_4.wav', death5: 'audio/character/death_5.wav',
  taunt_eatthat:   'audio/character/taunt_eatthat.wav',
  taunt_yousuck:   'audio/character/taunt_yousuck.wav',
  taunt_loser:     'audio/character/taunt_loser.wav',
  taunt_sucker:    'audio/character/taunt_sucker.wav',
  taunt_letsrock:  'audio/character/taunt_letsrock.wav',
  taunt_ohyeah:    'audio/character/taunt_ohyeah.wav',
  taunt_slaughter: 'audio/character/taunt_slaughter.wav',
  taunt_nailedem:  'audio/character/taunt_nailedem.wav',
  taunt_likethat:  'audio/character/taunt_likethat.wav',
  taunt_nasty:     'audio/character/taunt_nasty.wav',
  taunt_nice:      'audio/character/taunt_nice.wav',
  taunt_yeehaw:    'audio/character/taunt_yeehaw.wav',
};

const MENU_FILES = {
  big_select: 'audio/menu/big_select.wav',
  little_select: 'audio/menu/little_select.wav',
  window_open: 'audio/menu/window_open.wav',
};

const announcerBuffers = {};
const weaponBuffers    = {};
const charBuffers      = {};
const menuBuffers      = {};
const TAUNT_KEYS = ['eatthat','yousuck','loser','sucker','letsrock','ohyeah','slaughter','nailedem','likethat','nasty','nice','yeehaw'];

// ── Load ─────────────────────────────────────────────────────────────────────

async function loadAllSounds() {
  const ctx = ensureAudio();
  const loadMap = async (files, target) => {
    for (const [key, path] of Object.entries(files)) {
      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(res.status);
        target[key] = await ctx.decodeAudioData(await res.arrayBuffer());
      } catch { /* missing file → procedural fallback */ }
    }
  };
  await Promise.all([
    loadMap(ANNOUNCER_FILES, announcerBuffers),
    loadMap(WEAPON_FILES,    weaponBuffers),
    loadMap(CHAR_FILES,      charBuffers),
    loadMap(MENU_FILES,      menuBuffers),
  ]);
}

// ── Playback helpers ──────────────────────────────────────────────────────────

function playBuffer(buf, vol = 1.0, onEnded) {
  if (!buf) {
    onEnded?.();
    return;
  }
  const ctx = ensureAudio();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  if (onEnded) src.onended = onEnded;
  if (vol !== 1.0) {
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(outputNode(ctx));
  } else {
    src.connect(outputNode(ctx));
  }
  src.start();
}

window.__TA_AUDIO_APPLY_SETTINGS = applyAudioSettings;
window.__TA_AUDIO_GET_SETTINGS = () => ({ volume: audioVolume, mode: audioMode });

function playWeaponFire() {
  if (weaponBuffers.shock_fire) { playBuffer(weaponBuffers.shock_fire, 0.75); return; }
  sfxShoot(1);
}

/** Other shooters: same Instagib sample, quieter with distance; cap against “mud”. */
let spatialWeaponVoices = 0;
const SPATIAL_WEAPON_MAX = 6;
const SPATIAL_SKIP_QUIET_VOL = 0.11;
const SPATIAL_REF_DIST = 20;

function playWeaponFireSpatial(dist) {
  const d = Math.max(0, dist);
  const linear = SPATIAL_REF_DIST / (SPATIAL_REF_DIST + d);
  const vol = Math.max(0.035, Math.min(0.72, linear * 0.72));

  if (spatialWeaponVoices >= SPATIAL_WEAPON_MAX && vol < SPATIAL_SKIP_QUIET_VOL) return;

  const done = () => { spatialWeaponVoices = Math.max(0, spatialWeaponVoices - 1); };
  spatialWeaponVoices++;

  if (weaponBuffers.shock_fire) {
    playBuffer(weaponBuffers.shock_fire, vol, done);
  } else {
    sfxShoot(Math.min(1, vol / 0.72));
    setTimeout(done, 160);
  }
}

function playJumpSound() {
  if (charBuffers.jump) { playBuffer(charBuffers.jump, 0.55); return; }
  synth(0.06, 160, 0.04, 'sine', 1200, 0.5);
}

function playLandSound(hard = false) {
  if (charBuffers.land) { playBuffer(charBuffers.land, hard ? 0.65 : 0.4); }
}

function playDeathSound() {
  const keys = ['death1','death3','death4','death5'].filter(k => charBuffers[k]);
  if (keys.length) playBuffer(charBuffers[keys[Math.floor(Math.random() * keys.length)]], 0.85);
}

function playRandomTaunt() {
  const available = TAUNT_KEYS.map(k => 'taunt_' + k).filter(k => charBuffers[k]);
  if (available.length) playBuffer(charBuffers[available[Math.floor(Math.random() * available.length)]], 0.9);
}

function playMenuSelect(big = false) {
  const key = big ? 'big_select' : 'little_select';
  if (menuBuffers[key]) playBuffer(menuBuffers[key], 0.8);
}

function playWindowOpen() {
  if (menuBuffers.window_open) playBuffer(menuBuffers.window_open, 0.7);
}

function playAnnouncer(type) {
  if (announcerBuffers[type]) { playBuffer(announcerBuffers[type]); return; }
  sfxAnnounce(type);
}

function playCountdownAudio(sec) {
  const key = 'cd' + sec;
  if (announcerBuffers[key]) { playBuffer(announcerBuffers[key]); return; }
  sfxCountdownBeep(sec <= 3);
}

function playRoundStartAudio() {
  if (announcerBuffers.roundstart) { playBuffer(announcerBuffers.roundstart); return; }
  sfxRoundStart();
}

function playRoundEndAudio(playerWon) {
  const key = playerWon ? 'roundwin' : 'roundlose';
  if (announcerBuffers[key]) { playBuffer(announcerBuffers[key]); return; }
  sfxRoundEnd();
}

// ── Debug sound catalog (for Debug Lab map) ───────────────────────────────────
const DEBUG_SOUND_ACTIONS = [
  { id: 'weapon_fire', label: 'Weapon fire', color: 0xff44cc },
  { id: 'jump', label: 'Jump', color: 0x66ccff },
  { id: 'land_soft', label: 'Land soft', color: 0x88aaff },
  { id: 'land_hard', label: 'Land hard', color: 0xffaa44 },
  { id: 'death', label: 'Death', color: 0xff5555 },
  { id: 'menu_big', label: 'Menu big', color: 0x77ddff },
  { id: 'menu_little', label: 'Menu little', color: 0x55bbff },
  { id: 'menu_window', label: 'Menu window', color: 0x88eeff },
  { id: 'ann_double', label: 'Double', color: 0xaa77ff },
  { id: 'ann_multi', label: 'Multi', color: 0xbb66ff },
  { id: 'ann_ultra', label: 'Ultra', color: 0xcc55ff },
  { id: 'ann_monster', label: 'Monster', color: 0xff2266 },
  { id: 'ann_firstblood', label: 'First blood', color: 0xff4455 },
  { id: 'ann_spree', label: 'Spree', color: 0xff8844 },
  { id: 'ann_rampage', label: 'Rampage', color: 0xff6644 },
  { id: 'ann_dominating', label: 'Dominating', color: 0xff4444 },
  { id: 'ann_unstoppable', label: 'Unstoppable', color: 0xee3355 },
  { id: 'ann_godlike', label: 'Godlike', color: 0xff1144 },
  { id: 'countdown_10', label: 'Countdown 10', color: 0xffcc66 },
  { id: 'countdown_3', label: 'Countdown 3', color: 0xffdd88 },
  { id: 'round_start', label: 'Round start', color: 0x55ffcc },
  { id: 'round_win', label: 'Round win', color: 0xffcc66 },
  { id: 'round_lose', label: 'Round lose', color: 0xcc8866 },
  { id: 'taunt_random', label: 'Taunt random', color: 0x66ff88 },
  { id: 'igp_pickup_udmg', label: 'IG+ pickup UDamage', color: 0xaa77ff },
  { id: 'igp_pickup_tnt', label: 'IG+ pickup TNT', color: 0xff7744 },
  { id: 'igp_pickup_shield', label: 'IG+ pickup Shield', color: 0x77aaff },
  { id: 'igp_shield_break', label: 'IG+ shield break', color: 0xccddee },
];

function debugPlaySound(id) {
  switch (id) {
    case 'weapon_fire': playWeaponFire(); break;
    case 'jump': playJumpSound(); break;
    case 'land_soft': playLandSound(false); break;
    case 'land_hard': playLandSound(true); break;
    case 'death': playDeathSound(); break;
    case 'menu_big': playMenuSelect(true); break;
    case 'menu_little': playMenuSelect(false); break;
    case 'menu_window': playWindowOpen(); break;
    case 'ann_double': playAnnouncer('double'); break;
    case 'ann_multi': playAnnouncer('multi'); break;
    case 'ann_ultra': playAnnouncer('ultra'); break;
    case 'ann_monster': playAnnouncer('monster'); break;
    case 'ann_firstblood': playAnnouncer('firstblood'); break;
    case 'ann_spree': playAnnouncer('spree'); break;
    case 'ann_rampage': playAnnouncer('rampage'); break;
    case 'ann_dominating': playAnnouncer('dominating'); break;
    case 'ann_unstoppable': playAnnouncer('unstoppable'); break;
    case 'ann_godlike': playAnnouncer('godlike'); break;
    case 'countdown_10': playCountdownAudio(10); break;
    case 'countdown_3': playCountdownAudio(3); break;
    case 'round_start': playRoundStartAudio(); break;
    case 'round_win': playRoundEndAudio(true); break;
    case 'round_lose': playRoundEndAudio(false); break;
    case 'taunt_random': playRandomTaunt(); break;
    case 'igp_pickup_udmg': sfxInstagibPlusPickupUdmg(); break;
    case 'igp_pickup_tnt': sfxInstagibPlusPickupTnt(); break;
    case 'igp_pickup_shield': sfxInstagibPlusPickupShield(); break;
    case 'igp_shield_break': sfxInstagibPlusShieldBreak(); break;
    default: return false;
  }
  return true;
}

window.__TA_DEBUG_SOUND_ACTIONS = DEBUG_SOUND_ACTIONS;
window.__TA_DEBUG_PLAY = debugPlaySound;
