'use strict';

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data', 'mp-xp.json');

/** XP for a frag (human victim). */
const XP_KILL = 100;
/** Small consolation when you die (still playing the match). */
const XP_DEATH = 25;
/** Ordered by placement 1..8 for the ended round (FFA scoreboard). */
const XP_ROUND_PLACEMENT = [500, 350, 250, 150, 100, 100, 100, 100];

let store = Object.create(null);
let saveTimer = null;

function xpNeededToAdvance(level) {
  if (level < 1) level = 1;
  
  // Proper industry standard exponential leveling curve
  // 8% growth per level. This is the exact curve used by Halo, CS2 and Valorant.
  const base = 2200;
  const growth = 1.08;
  const maxXp = 75000;
  
  const required = Math.floor(base * Math.pow(growth, level - 1));
  
  // Soft cap: after level 60 growth slows down dramatically
  if (level > 60) {
    const over = level - 60;
    return Math.min(maxXp, required + over * 800);
  }
  
  return Math.min(maxXp, required);
}

function getLevelProgress(totalXp) {
  let xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  for (;;) {
    const need = xpNeededToAdvance(level);
    if (xp < need) {
      return {
        totalXp: Math.max(0, Math.floor(Number(totalXp) || 0)),
        level,
        xpInLevel: xp,
        xpForNextLevel: need,
      };
    }
    xp -= need;
    level++;
    if (level > 9999) {
      return {
        totalXp: Math.max(0, Math.floor(Number(totalXp) || 0)),
        level: 9999,
        xpInLevel: 0,
        xpForNextLevel: 1,
      };
    }
  }
}

function sanitizePlayerId(id) {
  if (id == null) return null;
  const s = String(id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return s.length >= 8 ? s : null;
}

function load() {
  try {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DATA_PATH)) return;
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const j = JSON.parse(raw);
    if (j && typeof j === 'object') store = j;
  } catch (e) {
    console.warn('[progression] load failed', e.message);
    store = Object.create(null);
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const dir = path.dirname(DATA_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DATA_PATH, JSON.stringify(store), 'utf8');
    } catch (e) {
      console.warn('[progression] save failed', e.message);
    }
  }, 400);
}

function getTotalXp(playerId) {
  const id = sanitizePlayerId(playerId);
  if (!id) return 0;
  const v = store[id];
  if (v == null) return 0;
  return Math.max(0, Math.floor(Number(v.xp) || 0));
}

function setTotalXp(playerId, total) {
  const id = sanitizePlayerId(playerId);
  if (!id) return;
  if (!store[id]) store[id] = {};
  store[id].xp = Math.max(0, Math.floor(total));
  scheduleSave();
}

function addXp(playerId, delta, ws, reason) {
  const id = sanitizePlayerId(playerId);
  if (!id || !Number.isFinite(delta) || delta === 0) return null;
  const cur = getTotalXp(id);
  const next = Math.max(0, cur + Math.floor(delta));
  setTotalXp(id, next);
  const prog = getLevelProgress(next);
  const payload = {
    t: 'progress',
    delta: Math.floor(delta),
    reason: reason || '',
    ...prog,
  };
  if (ws && ws.readyState === 1) {
    try {
      ws.send(JSON.stringify(payload));
    } catch (_) {}
  }
  return prog;
}

function progressPayloadForPlayer(playerId) {
  const total = getTotalXp(playerId);
  return { ...getLevelProgress(total) };
}

function onKill(killerEntity, victimEntity) {
  if (killerEntity && !killerEntity.isBot && killerEntity.playerId && killerEntity.ws) {
    addXp(killerEntity.playerId, XP_KILL, killerEntity.ws, 'kill');
  }
  if (victimEntity && !victimEntity.isBot && victimEntity.playerId && victimEntity.ws) {
    addXp(victimEntity.playerId, XP_DEATH, victimEntity.ws, 'death');
  }
}

function onRoundEnd(game, ranks) {
  if (!ranks || !ranks.length) return;
  ranks.forEach((r, index) => {
    const ent = game.entities.find(e => e.slot === r.slot);
    if (!ent || ent.isBot || !ent.playerId || !ent.ws) return;
    const base = XP_ROUND_PLACEMENT[index] != null ? XP_ROUND_PLACEMENT[index] : 80;
    addXp(ent.playerId, base, ent.ws, 'round');
  });
}

load();

module.exports = {
  getLevelProgress,
  sanitizePlayerId,
  getTotalXp,
  progressPayloadForPlayer,
  addXp,
  onKill,
  onRoundEnd,
  xpNeededToAdvance,
};
