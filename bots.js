// ═══════════════════════════════════════════════════════════════════════════════
// BOTS — AI, mesh creation, shooting, update loop
// Requires: scene, camera, THREE, state, bots, arenaObjects,
//          spawnBeam, instagibPlayer, killBot, addKillFeedEntry, showKillMsg,
//          playWeaponFireSpatial, playDeathSound, playRandomTaunt,
//          resolveBoxCollision, INSTAGIB, GRAVITY, JUMP_SPEED, randomSpawn,
//          currentMap, MAP_BOUNDS, roundActive (from game.js / maps.js)
// Default: procedural arena fighters (UT99 / Q3-style silhouettes).
// Optional: set GLB filenames below and place them in ./models/arena/
// ═══════════════════════════════════════════════════════════════════════════════

const bots = [];

/** Preloaded GLTF roots + clips (optional) */
const botModelTemplates = [];

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_BOT_COUNT = 8;
const BOT_SPEED        = 9.8;
const BOT_HEIGHT       = 2.2;
const BOT_SHOOT_SPREAD = 0.2;
const BOT_PRESET_KEY = 'ta_bot_skill_preset';
const BOT_DIFFICULTY_KEY = 'ta_bot_difficulty_level_v1';
const NAV_LEARN_STORAGE_KEY = 'ta_nav_autolearn_v1';
const NAV_ALWAYS_LEARN_KEY = 'ta_nav_always_learn_v1';
const BOT_DIFFICULTY_LEVELS = {
  1: { name: 'Fresh Meat', speedMul: 0.88, spreadMul: 1.45, retargetMul: 1.22, shootDelayMul: 1.28, repositionMul: 1.18, reactionMul: 1.35, skillOffset: -0.14 },
  2: { name: 'Cannon Fodder', speedMul: 0.94, spreadMul: 1.2, retargetMul: 1.1, shootDelayMul: 1.14, repositionMul: 1.08, reactionMul: 1.16, skillOffset: -0.07 },
  3: { name: 'Bloodthirsty', speedMul: 1.0, spreadMul: 1.0, retargetMul: 1.0, shootDelayMul: 1.0, repositionMul: 1.0, reactionMul: 1.0, skillOffset: 0.0 },
  4: { name: 'Nightmare', speedMul: 1.06, spreadMul: 0.85, retargetMul: 0.9, shootDelayMul: 0.88, repositionMul: 0.92, reactionMul: 0.84, skillOffset: 0.08 },
  5: { name: 'Unreal', speedMul: 1.12, spreadMul: 0.72, retargetMul: 0.82, shootDelayMul: 0.78, repositionMul: 0.86, reactionMul: 0.74, skillOffset: 0.14 },
};
const BOT_PRESETS = {
  arcade: {
    speedMul: 0.92,
    spreadMul: 1.18,
    retargetMul: 1.2,
    shootDelayMul: 1.22,
    repositionMul: 1.25,
    reactionMul: 1.15,
  },
  classic: {
    speedMul: 1.0,
    spreadMul: 1.0,
    retargetMul: 1.0,
    shootDelayMul: 1.0,
    repositionMul: 1.0,
    reactionMul: 1.0,
  },
  sweaty: {
    speedMul: 1.06,
    spreadMul: 0.84,
    retargetMul: 0.82,
    shootDelayMul: 0.82,
    repositionMul: 0.82,
    reactionMul: 0.82,
  },
};
let activeBotPresetId = 'classic';
let activeBotPreset = BOT_PRESETS.classic;
let botDifficultyLevel = 3;
const navLearnState = {
  training: false,
  alwaysLearn: true,
  mapKey: '',
  graph: null,
  sampleTimer: 0,
  nodeRadiusXZ: 4.8,
  nodeRadiusY: 1.5,
  learnedEdges: 0,
  learnedNodes: 0,
  totalSamples: 0,
  dirty: false,
  minLearnMove: 1.45,
  maxOutEdgesPerNode: 5,
  forceTurnAngleDeg: 30,
  collinearDotMin: 0.965,
  bootstrapActive: false,
  bootstrapStartMs: 0,
  bootstrapDurationMs: 180000,
  bootstrapConfig: {
    minLearnMove: 0.95,
    nodeRadiusXZ: 6.1,
    maxOutEdgesPerNode: 7,
    forceTurnAngleDeg: 22,
    simplifyEverySamples: 240,
    saveEverySamples: 120,
  },
  stableConfig: {
    minLearnMove: 1.45,
    nodeRadiusXZ: 4.8,
    maxOutEdgesPerNode: 5,
    forceTurnAngleDeg: 30,
    simplifyEverySamples: 600,
    saveEverySamples: 240,
  },
};
// ═══════════════════════════════════════════════════════════════════════════════
// ADVANCED BOT AI SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════════

// ── High-Ground System ─────────────────────────────────────────────────────────
const HIGH_GROUND_SYSTEM = {
  enabled: true,
  // Height thresholds for considering positions advantageous
  heightAdvantageThreshold: 2.5,  // meters above target to count as "high ground"
  maxHeightBias: 15,              // maximum height difference to consider
  
  // Scoring multipliers
  heightPreference: {
    aggressive: 0.3,   // aggressive bots care less about height
    cautious: 0.9,     // cautious bots really want high ground
    flanker: 0.7,      // flankers use height for angles
    duelist: 0.6,      // duelists appreciate elevation
    rusher: 0.2,       // rushers don't care
  },
  
  // LOS advantage from height
  heightLoSBonus: 0.25,  // extra chance to have LOS from above
  
  // Retreat to high ground when low HP
  retreatHighGroundBonus: 0.4,
};

// ── Cover System ──────────────────────────────────────────────────────────────
const COVER_SYSTEM = {
  enabled: true,
  // Distance ranges
  minCoverDist: 2.5,     // too close to obstacle = not cover
  maxCoverDist: 12,      // too far from cover = no benefit
  idealCoverDist: 4.5,   // sweet spot distance from cover
  
  // Cover evaluation
  coverHeightMin: 1.8,   // minimum height to count as cover
  coverWidthMin: 1.2,    // minimum width
  
  // Movement modes
  coverStickiness: 0.65, // tendency to stay in cover vs push
  peekDuration: 0.15,    // seconds to expose for shots
  coverResetTime: 1.2,   // time before re-evaluating cover
  
  // Personality modifiers
  coverPreference: {
    aggressive: 0.2,     // aggressive: push more, use cover less
    cautious: 0.95,      // cautious: stick to cover
    flanker: 0.55,       // flanker: use cover to move
    duelist: 0.45,       // duelist: moderate cover use
    rusher: 0.1,         // rusher: almost no cover
  },
};

// ── Dynamic Personality System ────────────────────────────────────────────────
const PERSONALITY_SYSTEM = {
  enabled: true,
  
  // State definitions with behaviors
  states: {
    confident: {
      aimSpreadMul: 0.92,
      speedMul: 1.08,
      aggression: 1.25,
      retreatThreshold: 0.25,
      coverPreference: 0.35,
      highGroundDesire: 0.4,
      peekFrequency: 1.3,
    },
    neutral: {
      aimSpreadMul: 1.0,
      speedMul: 1.0,
      aggression: 1.0,
      retreatThreshold: 0.35,
      coverPreference: 0.55,
      highGroundDesire: 0.6,
      peekFrequency: 1.0,
    },
    desperate: {
      aimSpreadMul: 1.12,
      speedMul: 1.05,
      aggression: 0.7,
      retreatThreshold: 0.55,
      coverPreference: 0.85,
      highGroundDesire: 0.9,
      peekFrequency: 0.6,
    },
    hunted: {
      aimSpreadMul: 1.18,
      speedMul: 0.95,
      aggression: 0.4,
      retreatThreshold: 0.7,
      coverPreference: 0.95,
      highGroundDesire: 0.5,  // might not have time for high ground
      peekFrequency: 0.4,
    },
    dominating: {
      aimSpreadMul: 0.85,
      speedMul: 1.1,
      aggression: 1.4,
      retreatThreshold: 0.15,
      coverPreference: 0.2,
      highGroundDesire: 0.5,
      peekFrequency: 1.5,
    },
  },
  
  // Triggers for state changes
  triggers: {
    // Score based (kills - deaths)
    dominatingThreshold: 4,    // +4 or more
    confidentThreshold: 2,   // +2 or more
    desperateThreshold: -3,    // -3 or worse
    huntedThreshold: -5,     // -5 or worse (getting farmed)
    
    // Health based overrides
    criticalHealth: 25,      // below this, go defensive
    lowHealth: 50,           // below this, consider retreat
    
    // Time based decay
    stateMemoryDuration: 45, // seconds to remember being "hunted"
  },
  
  // Personal nemesis system
  nemesis: {
    minDeathsToNemesis: 3,
    nemesisFocusBonus: 0.35,
    nemesisRevengeAggression: 1.3,
  },
};

// Track high ground nodes per map
const highGroundCache = new Map();
const coverCache = new Map();

const navOverlayState = {
  visible: false,
  group: null,
  lastRenderAt: 0,
};
const navSupplementalState = {
  mapKey: '',
  nodeCount: 0,
  edges: [],
};
const navLayerState = {
  mapKey: '',
  nodeCount: 0,
  nodeLayer: [],
  layerY: [],
};
const botNavDebugState = {
  enabled: false,
  panel: null,
  refreshTimer: 0,
};

function setAlwaysLearn(active, persist = true) {
  navLearnState.alwaysLearn = !!active;
  if (persist) {
    try { localStorage.setItem(NAV_ALWAYS_LEARN_KEY, navLearnState.alwaysLearn ? '1' : '0'); } catch (_) {}
  }
}

function isAlwaysLearn() {
  return !!navLearnState.alwaysLearn;
}

function setBotPreset(id, persist = true) {
  const nextId = (typeof id === 'string' && BOT_PRESETS[id]) ? id : 'classic';
  activeBotPresetId = nextId;
  activeBotPreset = BOT_PRESETS[nextId];
  if (persist) {
    try { localStorage.setItem(BOT_PRESET_KEY, nextId); } catch (_) {}
  }
}

function getBotPreset() {
  return activeBotPresetId;
}

function clampDifficultyLevel(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function getDifficultySettings() {
  return BOT_DIFFICULTY_LEVELS[botDifficultyLevel] || BOT_DIFFICULTY_LEVELS[3];
}

function getDifficultyTierName() {
  if (botDifficultyLevel <= 2) return 'easy';
  if (botDifficultyLevel >= 4) return 'hard';
  return 'normal';
}

function getDifficultyHumanization(bot) {
  const tier = getDifficultyTierName();
  if (tier === 'easy') {
    return {
      reactionMul: 1.18,
      predictionMul: 0.86,
      aimSpreadMul: 1.14,
      driftMul: 1.22,
      peekChanceMul: 0.86,
      retreatBias: 1.24,
      chaseBias: 0.86,
    };
  }
  if (tier === 'hard') {
    return {
      reactionMul: 0.84,
      predictionMul: 1.1,
      aimSpreadMul: 0.9,
      driftMul: 0.82,
      peekChanceMul: 1.2,
      retreatBias: 0.82,
      chaseBias: 1.18,
    };
  }
  return {
    reactionMul: 1.0,
    predictionMul: 1.0,
    aimSpreadMul: 1.0,
    driftMul: 1.0,
    peekChanceMul: 1.0,
    retreatBias: 1.0,
    chaseBias: 1.0,
  };
}

function setBotDifficulty(level, persist = true) {
  botDifficultyLevel = clampDifficultyLevel(level);
  const diff = getDifficultySettings();
  for (const bot of bots) {
    if (!bot) continue;
    const idx = Number.isFinite(bot.colorIdx) ? (bot.colorIdx | 0) : 0;
    const baseSkill = BOT_SKILLS[idx] ?? 0.5;
    bot.skill = Math.max(0.05, Math.min(0.98, baseSkill + diff.skillOffset));
  }
  if (persist) {
    try { localStorage.setItem(BOT_DIFFICULTY_KEY, String(botDifficultyLevel)); } catch (_) {}
  }
}

function getBotDifficulty() {
  return botDifficultyLevel;
}

function isClassicRulesetActive() {
  return typeof window.__TA_IS_CLASSIC_RULESET === 'function' && !!window.__TA_IS_CLASSIC_RULESET();
}

function isInstagibPlusRulesetActive() {
  return typeof window.__TA_IS_INSTAGIB_PLUS_RULESET === 'function' && !!window.__TA_IS_INSTAGIB_PLUS_RULESET();
}

try {
  setBotPreset(localStorage.getItem(BOT_PRESET_KEY) || 'classic', false);
} catch (_) {
  setBotPreset('classic', false);
}
try {
  setBotDifficulty(localStorage.getItem(BOT_DIFFICULTY_KEY) || 3, false);
} catch (_) {
  setBotDifficulty(3, false);
}
try {
  const al = localStorage.getItem(NAV_ALWAYS_LEARN_KEY);
  if (al === '0') setAlwaysLearn(false, false);
  else if (al === '1') setAlwaysLearn(true, false);
} catch (_) {}

window.__TA_BOT_SET_PRESET = setBotPreset;
window.__TA_BOT_GET_PRESET = getBotPreset;
window.__TA_BOT_SET_DIFFICULTY = setBotDifficulty;
window.__TA_BOT_GET_DIFFICULTY = getBotDifficulty;

function arenaSignature() {
  const arr = (arenaObjects || []).map(o => {
    const p = o.mesh && o.mesh.position ? o.mesh.position : { x: 0, y: 0, z: 0 };
    const x = Math.round((p.x || 0) * 10) / 10;
    const y = Math.round((p.y || 0) * 10) / 10;
    const z = Math.round((p.z || 0) * 10) / 10;
    const w = Math.round((o.hw * 2) * 10) / 10;
    const h = Math.round((o.hh * 2) * 10) / 10;
    const d = Math.round((o.hd * 2) * 10) / 10;
    return `${x},${y},${z},${w},${h},${d}`;
  }).sort();
  let h = 2166136261;
  const s = arr.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function arenaSignature() {
  const arr = (arenaObjects || []).map(o => {
    const p = o.mesh && o.mesh.position ? o.mesh.position : { x: 0, y: 0, z: 0 };
    const x = Math.round((p.x || 0) * 10) / 10;
    const y = Math.round((p.y || 0) * 10) / 10;
    const z = Math.round((p.z || 0) * 10) / 10;
    const w = Math.round((o.hw * 2) * 10) / 10;
    const h = Math.round((o.hh * 2) * 10) / 10;
    const d = Math.round((o.hd * 2) * 10) / 10;
    return `${x},${y},${z},${w},${h},${d}`;
  }).sort();
  let h = 2166136261;
  const s = arr.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIGH-GROUND ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

function getHighGroundKey() {
  return `hg_${currentMap}_${arenaSignature()}`;
}

function analyzeHighGround() {
  const key = getHighGroundKey();
  if (highGroundCache.has(key)) return highGroundCache.get(key);
  
  const heights = [];
  const nodeMap = new Map();
  
  // Collect all distinct heights from arena objects
  for (const obj of arenaObjects || []) {
    if (!obj || !obj.mesh) continue;
    const topY = obj.mesh.position.y + obj.hh;
    const floorY = obj.mesh.position.y - obj.hh;
    
    // Only consider substantial platforms
    if (obj.hw > 2 && obj.hd > 2 && obj.hh > 0.5) {
      const info = {
        y: topY,
        center: obj.mesh.position,
        size: { w: obj.hw, h: obj.hh, d: obj.hd },
        area: obj.hw * obj.hd,
      };
      
      const floorKey = Math.floor(floorY * 2) / 2;
      if (!nodeMap.has(floorKey) || nodeMap.get(floorKey).area < info.area) {
        nodeMap.set(floorKey, info);
      }
      
      // Track platform tops
      const topKey = Math.floor(topY * 2) / 2;
      if (!heights.includes(topY)) heights.push(topY);
    }
  }
  
  // Sort heights descending (highest first)
  heights.sort((a, b) => b - a);
  
  const highGroundData = {
    heights,
    platforms: Array.from(nodeMap.values()),
    averageHeight: heights.length > 0 ? heights.reduce((a, b) => a + b, 0) / heights.length : 0,
    maxHeight: heights.length > 0 ? heights[0] : 0,
  };
  
  highGroundCache.set(key, highGroundData);
  return highGroundData;
}

function getHighGroundAttractiveness(bot, pos, targetPos, targetHeight) {
  if (!HIGH_GROUND_SYSTEM.enabled) return 0;
  
  const hg = analyzeHighGround();
  if (!hg.heights.length) return 0;
  
  const personality = bot.personality || 'aggressive';
  const baseDesire = HIGH_GROUND_SYSTEM.heightPreference[personality] || 0.5;
  
  // If we're already higher than target, less desire to go higher
  const currentHeight = pos.y;
  const heightAdvantage = currentHeight - targetHeight;
  
  if (heightAdvantage > HIGH_GROUND_SYSTEM.heightAdvantageThreshold) {
    // We're already dominating from above
    return 0.15 * baseDesire;  // minor preference to maintain position
  }
  
  // Calculate potential high ground positions
  let bestScore = 0;
  
  for (const platform of hg.platforms) {
    const heightDiff = platform.y - currentHeight;
    if (heightDiff < 1.5 || heightDiff > HIGH_GROUND_SYSTEM.maxHeightBias) continue;
    
    const dist = Math.hypot(platform.center.x - pos.x, platform.center.z - pos.z);
    if (dist > 40) continue;  // too far
    
    // Score based on height advantage over target
    const targetHeightDiff = platform.y - targetHeight;
    const heightValue = Math.max(0, Math.min(1, targetHeightDiff / 8));
    
    // Distance penalty
    const distFactor = 1 - Math.min(1, dist / 30);
    
    // LOS advantage estimate
    const estimatedLoS = 0.6 + (heightValue * HIGH_GROUND_SYSTEM.heightLoSBonus);
    
    const score = heightValue * distFactor * estimatedLoS * baseDesire;
    bestScore = Math.max(bestScore, score);
  }
  
  // Modify based on bot state
  const dynamicState = getBotDynamicState(bot);
  if (dynamicState) {
    bestScore *= (dynamicState.highGroundDesire || 0.6);
  }
  
  // Low HP bonus for defensive positioning
  const hpPct = (bot.health || 100) / 100;
  if (hpPct < 0.3) {
    bestScore += HIGH_GROUND_SYSTEM.retreatHighGroundBonus * (1 - hpPct);
  }
  
  return Math.max(0, Math.min(1, bestScore));
}

function getHighGroundDirection(bot, pos, targetPos) {
  const hg = analyzeHighGround();
  if (!hg.platforms.length) return null;
  
  let bestPlatform = null;
  let bestScore = -Infinity;
  
  const currentHeight = pos.y;
  const targetHeight = targetPos ? targetPos.y : currentHeight;
  
  for (const platform of hg.platforms) {
    const heightDiff = platform.y - currentHeight;
    if (heightDiff < 1.5) continue;  // not higher
    if (heightDiff > HIGH_GROUND_SYSTEM.maxHeightBias) continue;
    
    const dist = Math.hypot(platform.center.x - pos.x, platform.center.z - pos.z);
    if (dist > 35) continue;
    
    // Score components
    const heightAdvantage = platform.y - targetHeight;
    const heightScore = Math.max(0, heightAdvantage) / HIGH_GROUND_SYSTEM.maxHeightBias;
    const distScore = 1 - Math.min(1, dist / 30);
    
    // Check if we can reach it
    const reachability = estimateReachability(pos, platform.center, platform.y);
    if (reachability < 0.3) continue;
    
    const score = heightScore * 0.4 + distScore * 0.35 + reachability * 0.25;
    
    if (score > bestScore) {
      bestScore = score;
      bestPlatform = platform;
    }
  }
  
  if (!bestPlatform) return null;
  
  const dir = new THREE.Vector3(
    bestPlatform.center.x - pos.x,
    0,
    bestPlatform.center.z - pos.z
  ).normalize();
  
  return { direction: dir, targetHeight: bestPlatform.y, score: bestScore };
}

function estimateReachability(fromPos, toPos, targetHeight) {
  const horizDist = Math.hypot(toPos.x - fromPos.x, toPos.z - fromPos.z);
  const vertDist = targetHeight - fromPos.y;
  
  // Simple reachability: can we jump that high and distance?
  if (vertDist > 8) return 0.1;  // very hard
  if (horizDist > 25 && vertDist > 4) return 0.3;
  if (vertDist < 3) return 1.0;  // easy step up
  if (vertDist < 6 && horizDist < 12) return 0.7;  // reachable with double jump
  return 0.4;  // might need nav path
}

// ═══════════════════════════════════════════════════════════════════════════════
// COVER SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function getCoverKey() {
  return `cover_${currentMap}_${arenaSignature()}`;
}

function analyzeCoverPoints() {
  const key = getCoverKey();
  if (coverCache.has(key)) return coverCache.get(key);
  
  const coverPoints = [];
  
  for (const obj of arenaObjects || []) {
    if (!obj || !obj.mesh) continue;
    
    // Must be tall enough for cover
    if (obj.hh < COVER_SYSTEM.coverHeightMin * 0.5) continue;
    if (obj.hw < COVER_SYSTEM.coverWidthMin && obj.hd < COVER_SYSTEM.coverWidthMin) continue;
    
    const pos = obj.mesh.position;
    const coverHeight = obj.hh * 2;
    
    // Generate cover positions around this object
    // Cardinal directions
    const offsets = [
      { x: obj.hw + COVER_SYSTEM.idealCoverDist, z: 0 },
      { x: -(obj.hw + COVER_SYSTEM.idealCoverDist), z: 0 },
      { x: 0, z: obj.hd + COVER_SYSTEM.idealCoverDist },
      { x: 0, z: -(obj.hd + COVER_SYSTEM.idealCoverDist) },
    ];
    
    for (const off of offsets) {
      coverPoints.push({
        x: pos.x + off.x,
        y: pos.y,
        z: pos.z + off.z,
        coverObject: obj,
        coverHeight,
        direction: { x: -off.x, z: -off.z },  // direction toward cover
      });
    }
  }
  
  coverCache.set(key, coverPoints);
  return coverPoints;
}

function findBestCover(bot, fromPos, threatPos) {
  if (!COVER_SYSTEM.enabled) return null;
  
  const covers = analyzeCoverPoints();
  if (!covers.length) return null;
  
  let bestCover = null;
  let bestScore = -Infinity;
  
  const personality = bot.personality || 'aggressive';
  const dynamicState = getBotDynamicState(bot);
  const coverPref = dynamicState ? dynamicState.coverPreference : COVER_SYSTEM.coverPreference[personality];
  
  for (const cover of covers) {
    const dist = Math.hypot(cover.x - fromPos.x, cover.z - fromPos.z);
    if (dist < COVER_SYSTEM.minCoverDist || dist > COVER_SYSTEM.maxCoverDist) continue;
    
    // Distance to threat from cover
    const distFromThreat = Math.hypot(cover.x - threatPos.x, cover.z - threatPos.z);
    
    // Does this cover actually block LOS from threat?
    const blocksLoS = doesCoverBlockLoS(cover, threatPos);
    if (!blocksLoS) continue;
    
    // Score components
    const distScore = 1 - Math.abs(dist - COVER_SYSTEM.idealCoverDist) / COVER_SYSTEM.maxCoverDist;
    const threatDistScore = Math.min(1, distFromThreat / 20);  // prefer not too close to threat
    const coverQuality = Math.min(1, cover.coverHeight / 3);
    
    // Prefer covers that give angles toward threat
    const angleToThreat = Math.atan2(threatPos.z - cover.z, threatPos.x - cover.x);
    const coverAngle = Math.atan2(cover.direction.z, cover.direction.x);
    const angleDiff = Math.abs(angleToThreat - coverAngle);
    const angleScore = 1 - Math.min(1, angleDiff / Math.PI);
    
    const score = (distScore * 0.3 + threatDistScore * 0.2 + coverQuality * 0.2 + angleScore * 0.3) * coverPref;
    
    if (score > bestScore) {
      bestScore = score;
      bestCover = cover;
    }
  }
  
  return bestCover ? { ...bestCover, score: bestScore } : null;
}

function doesCoverBlockLoS(coverPos, threatPos) {
  // Simple check: is the cover between us and threat?
  if (!coverPos.coverObject) return false;
  
  const obj = coverPos.coverObject;
  const objPos = obj.mesh.position;
  
  // Quick box check
  const dx = Math.abs(objPos.x - (coverPos.x + coverPos.direction.x * COVER_SYSTEM.idealCoverDist));
  const dz = Math.abs(objPos.z - (coverPos.z + coverPos.direction.z * COVER_SYSTEM.idealCoverDist));
  
  return dx < obj.hw + 1 && dz < obj.hd + 1;
}

function getCoverMovement(bot, pos, targetPos, hasLoS) {
  if (!COVER_SYSTEM.enabled) return null;
  
  const personality = bot.personality || 'aggressive';
  const dynamicState = getBotDynamicState(bot);
  const coverPref = dynamicState ? dynamicState.coverPreference : COVER_SYSTEM.coverPreference[personality];
  
  // If we have LoS and are aggressive, maybe don't seek cover
  if (hasLoS && dynamicState && dynamicState.aggression > 1.1 && Math.random() < 0.4) {
    return null;
  }
  
  // Check if we're already near good cover
  const covers = analyzeCoverPoints();
  let inCover = false;
  let currentCoverScore = 0;
  
  for (const cover of covers) {
    const dist = Math.hypot(cover.x - pos.x, cover.z - pos.z);
    if (dist < COVER_SYSTEM.idealCoverDist * 1.5) {
      inCover = true;
      currentCoverScore = doesCoverBlockLoS(cover, targetPos) ? 0.8 : 0.3;
      break;
    }
  }
  
  // If in good cover and not too aggressive, stay
  if (inCover && currentCoverScore > 0.6 && Math.random() < COVER_SYSTEM.coverStickiness) {
    return { action: 'hold', strength: coverPref };
  }
  
  // Find cover if we don't have LoS or are defensive
  if (!hasLoS || (dynamicState && dynamicState.aggression < 0.8)) {
    const bestCover = findBestCover(bot, pos, targetPos);
    if (bestCover && bestCover.score > 0.4) {
      const dir = new THREE.Vector3(
        bestCover.x - pos.x,
        0,
        bestCover.z - pos.z
      ).normalize();
      return { action: 'move_to_cover', direction: dir, strength: coverPref * bestCover.score };
    }
  }
  
  // Peeking from cover
  if (inCover && hasLoS && bot.peekExposeTimer <= 0) {
    const peekDir = new THREE.Vector3(
      targetPos.x - pos.x,
      0,
      targetPos.z - pos.z
    ).normalize();
    return { action: 'peek', direction: peekDir, strength: 1.0 };
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC PERSONALITY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function initializeBotDynamicState(bot) {
  bot.dynamicPersonality = {
    currentState: 'neutral',
    stateStartTime: performance.now() / 1000,
    killStreak: 0,
    deathStreak: 0,
    lastKiller: null,
    nemesis: null,
    nemesisDeathCount: 0,
    recentDamage: 0,
    stateModifiers: {},
  };
}

function updateBotDynamicState(bot, event = null) {
  if (!PERSONALITY_SYSTEM.enabled) return;
  if (!bot.dynamicPersonality) initializeBotDynamicState(bot);
  
  const dp = bot.dynamicPersonality;
  const now = performance.now() / 1000;
  const score = (bot.kills || 0) - (bot.deaths || 0);
  const hpPct = (bot.health || 100) / 100;
  
  // Process events
  if (event) {
    switch (event.type) {
      case 'kill':
        dp.killStreak++;
        dp.deathStreak = 0;
        if (event.victim === dp.nemesis) {
          dp.nemesis = null;
          dp.nemesisDeathCount = 0;
        }
        break;
      case 'death':
        dp.deathStreak++;
        dp.killStreak = 0;
        dp.lastKiller = event.killer;
        if (event.killer === dp.nemesis) {
          dp.nemesisDeathCount++;
        } else if (dp.nemesis && dp.nemesis !== event.killer) {
          dp.nemesisDeathCount = Math.max(0, dp.nemesisDeathCount - 1);
        } else if (!dp.nemesis || dp.nemesisDeathCount < PERSONALITY_SYSTEM.nemesis.minDeathsToNemesis) {
          // Consider new nemesis
          if (!dp.nemesis || event.killer !== dp.nemesis) {
            dp.nemesis = event.killer;
            dp.nemesisDeathCount = 1;
          }
        }
        break;
      case 'damage_taken':
        dp.recentDamage += event.amount;
        break;
    }
  }
  
  // Determine new state
  let newState = dp.currentState;
  
  // Priority: HP critical → hunted/desperate
  if (hpPct < PERSONALITY_SYSTEM.triggers.criticalHealth / 100) {
    newState = dp.deathStreak >= 2 ? 'hunted' : 'desperate';
  }
  // Score based states
  else if (score >= PERSONALITY_SYSTEM.triggers.dominatingThreshold) {
    newState = 'dominating';
  } else if (score <= PERSONALITY_SYSTEM.triggers.huntedThreshold) {
    newState = 'hunted';
  } else if (score >= PERSONALITY_SYSTEM.triggers.confidentThreshold) {
    newState = 'confident';
  } else if (score <= PERSONALITY_SYSTEM.triggers.desperateThreshold) {
    newState = 'desperate';
  } else {
    newState = 'neutral';
  }
  
  // Nemesis focus
  if (dp.nemesis && dp.nemesisDeathCount >= PERSONALITY_SYSTEM.nemesis.minDeathsToNemesis) {
    if (dp.nemesis.alive) {
      // Higher aggression when nemesis is present
      if (newState !== 'hunted') {
        newState = newState === 'confident' || newState === 'dominating' ? newState : 'confident';
      }
    }
  }
  
  // State transition
  if (newState !== dp.currentState) {
    dp.currentState = newState;
    dp.stateStartTime = now;
    dp.stateModifiers = PERSONALITY_SYSTEM.states[newState];
  }
  
  // Decay recent damage
  dp.recentDamage *= 0.98;
}

function getBotDynamicState(bot) {
  if (!PERSONALITY_SYSTEM.enabled || !bot.dynamicPersonality) return null;
  return PERSONALITY_SYSTEM.states[bot.dynamicPersonality.currentState] || PERSONALITY_SYSTEM.states.neutral;
}

function getNemesisTarget(bot) {
  if (!PERSONALITY_SYSTEM.enabled || !bot.dynamicPersonality) return null;
  const dp = bot.dynamicPersonality;
  if (dp.nemesis && dp.nemesisDeathCount >= PERSONALITY_SYSTEM.nemesis.minDeathsToNemesis) {
    if (dp.nemesis.alive) return dp.nemesis;
  }
  return null;
}

function modifyBotBehaviorByState(bot, baseBehavior) {
  const state = getBotDynamicState(bot);
  if (!state) return baseBehavior;
  
  return {
    ...baseBehavior,
    speedMul: (baseBehavior.speedMul || 1) * (state.speedMul || 1),
    aimSpreadMul: (baseBehavior.aimSpreadMul || 1) * (state.aimSpreadMul || 1),
    aggression: state.aggression || 1,
    shouldRetreat: (bot.health / 100) < state.retreatThreshold,
    coverPreference: state.coverPreference || 0.5,
    highGroundDesire: state.highGroundDesire || 0.5,
    peekFrequency: state.peekFrequency || 1,
  };
}

function getTargetPriorityWithNemesis(bot, candidates) {
  const nemesis = getNemesisTarget(bot);
  if (!nemesis) return candidates;
  
  // Boost nemesis priority
  return candidates.map(c => {
    if (c.ref === nemesis || (c.type === 'player' && nemesis === null)) {
      return { ...c, priority: (c.priority || 1) * PERSONALITY_SYSTEM.nemesis.nemesisFocusBonus };
    }
    return c;
  });
}

// Clear caches when map changes
function clearBotCaches() {
  highGroundCache.clear();
  coverCache.clear();
}

function navMapKey() {
  return `m${currentMap}-${arenaSignature()}`;
}

/** DM-Factory (5) & DM-Fletcher (6): high near map center → damp separation / wall-push / boost mid routes. */
function flatArenaCenterWeight(x, z) {
    if (currentMap === 5 || currentMap === 6) {
      const d = Math.hypot(Number(x) || 0, Number(z) || 0);
      return Math.max(0, 12.0 * (1 - Math.min(1, d / 48)));
    }
  return 0;
}

function getNavOutEdgeCapForNode(node) {
  let cap = navLearnState.maxOutEdgesPerNode;
  return cap;
}

function readNavStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(NAV_LEARN_STORAGE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch (_) {
    return {};
  }
}

function writeNavStore(store) {
  try { localStorage.setItem(NAV_LEARN_STORAGE_KEY, JSON.stringify(store)); } catch (_) {}
}

function ensureNavGraphLoaded() {
  const key = navMapKey();
  if (navLearnState.mapKey === key && navLearnState.graph) return;
  navLearnState.mapKey = key;
  const store = readNavStore();
  const g = store[key];
  if (g && Array.isArray(g.nodes) && Array.isArray(g.edges)) {
    navLearnState.graph = g;
  } else {
    navLearnState.graph = { version: 1, nodes: [], edges: [] };
  }
  navLearnState.learnedNodes = navLearnState.graph.nodes.length;
  navLearnState.learnedEdges = navLearnState.graph.edges.length;
  if (navSupplementalState.mapKey !== key || navSupplementalState.nodeCount !== navLearnState.learnedNodes) {
    navSupplementalState.mapKey = key;
    navSupplementalState.nodeCount = navLearnState.learnedNodes;
    navSupplementalState.edges = [];
  }
  if (navLayerState.mapKey !== key || navLayerState.nodeCount !== navLearnState.learnedNodes) {
    navLayerState.mapKey = key;
    navLayerState.nodeCount = navLearnState.learnedNodes;
    navLayerState.nodeLayer = [];
    navLayerState.layerY = [];
  }
}

function getSupplementalVerticalEdges() {
  ensureNavGraphLoaded();
  const g = navLearnState.graph;
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges) || g.nodes.length < 2) return [];
  if (navSupplementalState.edges.length) return navSupplementalState.edges;

  const existing = new Set();
  for (const e of g.edges) {
    if (!e || !Number.isFinite(e.a) || !Number.isFinite(e.b)) continue;
    existing.add(`${e.a}>${e.b}`);
  }

  const out = [];
  const nodes = g.nodes;
  const nCount = nodes.length;
  for (let i = 0; i < nCount; i++) {
    const a = nodes[i];
    if (!a) continue;
    for (let j = i + 1; j < nCount; j++) {
      const b = nodes[j];
      if (!b) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const horiz = Math.hypot(dx, dz);
      if (horiz > 7.8) continue;
      const dy = b.y - a.y;
      const absDy = Math.abs(dy);
      if (absDy < 1.35 || absDy > 6.25) continue;
      if (!navHasLineOfSight(a.x, a.y + 0.2, a.z, b.x, b.y + 0.2, b.z)) continue;

      const upAtoB = dy > 0;
      const aToBKey = `${i}>${j}`;
      const bToAKey = `${j}>${i}`;
      if (!existing.has(aToBKey)) {
        out.push({ a: i, b: j, w: 1.45, jump: upAtoB, drop: !upAtoB, supplemental: true });
        existing.add(aToBKey);
      }
      if (!existing.has(bToAKey)) {
        out.push({ a: j, b: i, w: 1.35, jump: !upAtoB, drop: upAtoB, supplemental: true });
        existing.add(bToAKey);
      }
    }
  }
  navSupplementalState.edges = out;
  return out;
}

function buildNavLayers() {
  ensureNavGraphLoaded();
  const g = navLearnState.graph;
  if (!g || !Array.isArray(g.nodes) || !g.nodes.length) return;
  if (navLayerState.nodeLayer.length === g.nodes.length && navLayerState.layerY.length > 0) return;

  const ys = g.nodes
    .map((n, i) => ({ i, y: Number(n.y) || 0 }))
    .sort((a, b) => a.y - b.y);

  const layerCenters = [];
  const nodeLayer = new Array(g.nodes.length).fill(0);
  const splitDy = 2.2;
  for (const item of ys) {
    let assigned = -1;
    for (let l = 0; l < layerCenters.length; l++) {
      if (Math.abs(item.y - layerCenters[l]) <= splitDy) {
        assigned = l;
        break;
      }
    }
    if (assigned < 0) {
      layerCenters.push(item.y);
      assigned = layerCenters.length - 1;
    } else {
      layerCenters[assigned] = layerCenters[assigned] * 0.82 + item.y * 0.18;
    }
    nodeLayer[item.i] = assigned;
  }
  navLayerState.nodeLayer = nodeLayer;
  navLayerState.layerY = layerCenters;
}

function getNodeLayer(idx) {
  buildNavLayers();
  return navLayerState.nodeLayer[idx] ?? 0;
}

function ensureBotNavDebugPanel() {
  if (botNavDebugState.panel) return botNavDebugState.panel;
  if (typeof document === 'undefined' || !document.body) return null;
  const panel = document.createElement('div');
  panel.id = 'bot-nav-debug';
  panel.style.position = 'fixed';
  panel.style.left = '10px';
  panel.style.top = '92px';
  panel.style.zIndex = '80';
  panel.style.maxWidth = '520px';
  panel.style.maxHeight = '42vh';
  panel.style.overflow = 'auto';
  panel.style.padding = '8px 10px';
  panel.style.border = '1px solid rgba(120,180,255,0.45)';
  panel.style.borderRadius = '6px';
  panel.style.background = 'rgba(8,14,24,0.82)';
  panel.style.color = '#d7ebff';
  panel.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  panel.style.fontSize = '11px';
  panel.style.lineHeight = '1.45';
  panel.style.whiteSpace = 'pre';
  panel.style.display = 'none';
  panel.style.pointerEvents = 'none';
  document.body.appendChild(panel);
  botNavDebugState.panel = panel;
  return panel;
}

function topBotFailEdges(bot, maxItems = 2) {
  if (!bot || !bot.navFailMem) return '';
  const entries = Object.entries(bot.navFailMem)
    .map(([k, v]) => ({ k, v: Number(v) || 0 }))
    .filter(it => it.v > 0.05)
    .sort((a, b) => b.v - a.v)
    .slice(0, Math.max(1, maxItems));
  if (!entries.length) return '-';
  return entries.map(it => `${it.k}:${it.v.toFixed(2)}`).join(', ');
}

function updateBotNavDebugOverlay(dt = 0.016) {
  const panel = ensureBotNavDebugPanel();
  if (!panel) return;
  panel.style.display = botNavDebugState.enabled ? 'block' : 'none';
  if (!botNavDebugState.enabled) return;
  botNavDebugState.refreshTimer = Math.max(0, (botNavDebugState.refreshTimer || 0) - dt);
  if (botNavDebugState.refreshTimer > 0) return;
  botNavDebugState.refreshTimer = 0.18;

  buildNavLayers();
  const lines = [];
  lines.push(`BOT NAV DEBUG  tier=${getDifficultyTierName()}  lvl=${botDifficultyLevel}`);
  lines.push(`layers=${navLayerState.layerY.length}  nodes=${navLearnState.learnedNodes}  edges=${navLearnState.learnedEdges}`);
  lines.push('name          state    layer  targetN  failEdges');
  lines.push('--------------------------------------------------------------');
  for (const bot of bots) {
    if (!bot || !bot.alive || !bot.mesh) continue;
    const nLayer = Number.isFinite(bot.navTargetNode) && bot.navTargetNode >= 0 ? getNodeLayer(bot.navTargetNode) : -1;
    const nm = String(bot.name || 'Bot').padEnd(12, ' ').slice(0, 12);
    const st = String(bot.aiState || 'fight').padEnd(8, ' ').slice(0, 8);
    const tn = Number.isFinite(bot.navTargetNode) ? String(bot.navTargetNode) : '-';
    lines.push(`${nm}  ${st}  ${String(nLayer).padStart(5, ' ')}  ${tn.padStart(7, ' ')}  ${topBotFailEdges(bot)}`);
  }
  if (lines.length <= 4) lines.push('(no alive bots)');
  panel.textContent = lines.join('\n');
}

function setBotNavDebugOverlay(active) {
  botNavDebugState.enabled = !!active;
  const panel = ensureBotNavDebugPanel();
  if (panel) panel.style.display = botNavDebugState.enabled ? 'block' : 'none';
}

function getBotNavDebugOverlay() {
  return !!botNavDebugState.enabled;
}

function chooseLayerTransitionNode(bot, start, goal, targetPos) {
  ensureNavGraphLoaded();
  buildNavLayers();
  const g = navLearnState.graph;
  if (!g || !Array.isArray(g.nodes)) return -1;
  const startLayer = getNodeLayer(start);
  const goalLayer = getNodeLayer(goal);
  if (startLayer === goalLayer) return -1;

  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < g.nodes.length; i++) {
    if (getNodeLayer(i) !== startLayer) continue;
    const n = g.nodes[i];
    if (!n) continue;
    let verticalReach = false;
    for (const e of g.edges) {
      if (!e || e.a !== i) continue;
      const ly = getNodeLayer(e.b);
      if (ly !== startLayer) { verticalReach = true; break; }
    }
    if (!verticalReach) {
      for (const e of getSupplementalVerticalEdges()) {
        if (e.a !== i) continue;
        const ly = getNodeLayer(e.b);
        if (ly !== startLayer) { verticalReach = true; break; }
      }
    }
    if (!verticalReach) continue;
    const dStart = Math.hypot(n.x - bot.mesh.position.x, n.z - bot.mesh.position.z);
    const dGoal = Math.hypot(n.x - targetPos.x, n.z - targetPos.z);
    const yBias = Math.abs((Number(n.y) || 0) - (Number(targetPos.y) || 0));
    const score = dStart * 0.65 + dGoal * 0.45 + yBias * 0.9;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function saveNavGraph() {
  ensureNavGraphLoaded();
  simplifyNavGraph();
  // Slow decay so old mistakes do not permanently poison routes.
  if (navLearnState.graph && Array.isArray(navLearnState.graph.nodes)) {
    for (const n of navLearnState.graph.nodes) {
      if (n && n.fallRisk) n.fallRisk = Math.max(0, n.fallRisk * 0.92 - 0.02);
      if (n && n.stuckRisk) n.stuckRisk = Math.max(0, n.stuckRisk * 0.9 - 0.03);
    }
  }
  if (navLearnState.graph && Array.isArray(navLearnState.graph.edges)) {
    for (const e of navLearnState.graph.edges) {
      if (e && e.fail) e.fail = Math.max(0, e.fail * 0.9 - 0.03);
    }
  }
  const store = readNavStore();
  store[navLearnState.mapKey] = navLearnState.graph;
  writeNavStore(store);
  navLearnState.learnedNodes = navLearnState.graph.nodes.length;
  navLearnState.learnedEdges = navLearnState.graph.edges.length;
  navLearnState.dirty = true;
}

function findOrCreateNavNode(pos) {
  ensureNavGraphLoaded();
  const nodes = navLearnState.graph.nodes;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const dx = n.x - pos.x;
    const dz = n.z - pos.z;
    const dy = Math.abs(n.y - pos.y);
    const d2 = dx * dx + dz * dz;
    if (d2 < navLearnState.nodeRadiusXZ * navLearnState.nodeRadiusXZ && dy < navLearnState.nodeRadiusY && d2 < bestD) {
      best = i;
      bestD = d2;
    }
  }
  if (best >= 0) return best;
  nodes.push({ x: pos.x, y: pos.y, z: pos.z, hits: 1 });
  navLearnState.dirty = true;
  return nodes.length - 1;
}

function upsertNavEdge(a, b, type = 'walk', gain = 1) {
  if (a < 0 || b < 0 || a === b) return;
  ensureNavGraphLoaded();
  const nodes = navLearnState.graph.nodes;
  const na = nodes[a];
  const nb = nodes[b];
  if (!na || !nb) return;
  const dx = nb.x - na.x;
  const dz = nb.z - na.z;
  const dy = nb.y - na.y;
  const horiz = Math.hypot(dx, dz);
  if (Math.abs(dy) > 6.2) return;
  if (type === 'walk' && horiz > 18) return;
  if (type === 'jump' && horiz > 14) return;
  if (type === 'drop' && horiz > 16) return;
  const edges = navLearnState.graph.edges;
  const g = Math.max(0.25, Math.min(6, Number(gain) || 1));
  for (const e of edges) {
    if (e.a === a && e.b === b) {
      e.w = Math.min(9999, (e.w || 1) + g);
      if (type === 'jump') e.jump = true;
      if (type === 'drop') e.drop = true;
      navLearnState.dirty = true;
      return;
    }
  }
  edges.push({ a, b, w: g, jump: type === 'jump', drop: type === 'drop' });
  navLearnState.dirty = true;
}

function navHasLineOfSight(ax, ay, az, bx, by, bz) {
  const from = new THREE.Vector3(ax, ay, az);
  const to = new THREE.Vector3(bx, by, bz);
  const dir = to.clone().sub(from);
  const dist = dir.length();
  if (dist < 0.001) return true;
  dir.multiplyScalar(1 / dist);
  const rc = new THREE.Raycaster(from, dir, 0.05, Math.max(0, dist - 0.15));
  const blockers = rc.intersectObjects((arenaObjects || []).filter(o => o && o.hw > 1.2).map(o => o.mesh), false);
  return blockers.length === 0;
}

function learnFromBotTrack(bot) {
  const p = bot.mesh.position;
  ensureNavGraphLoaded();
  if (typeof bot.navLastNode !== 'number' || bot.navLastNode < 0) {
    bot.navLastNode = findOrCreateNavNode({ x: p.x, y: p.y, z: p.z });
    bot.navLastLearnPos = { x: p.x, y: p.y, z: p.z };
    bot.navLastMoveDir = null;
    return;
  }
  const nodes = navLearnState.graph.nodes;
  const a = nodes[bot.navLastNode];
  if (!a) {
    bot.navLastNode = findOrCreateNavNode({ x: p.x, y: p.y, z: p.z });
    bot.navLastLearnPos = { x: p.x, y: p.y, z: p.z };
    bot.navLastMoveDir = null;
    return;
  }

  const vx = p.x - a.x;
  const vz = p.z - a.z;
  const horizFromLastNode = Math.hypot(vx, vz);
  const dyFromLastNode = p.y - a.y;
  if (horizFromLastNode < navLearnState.minLearnMove) return;

  const mvx = bot.navLastLearnPos ? (p.x - bot.navLastLearnPos.x) : vx;
  const mvz = bot.navLastLearnPos ? (p.z - bot.navLastLearnPos.z) : vz;
  const ml = Math.hypot(mvx, mvz) || 1;
  const curDirX = mvx / ml;
  const curDirZ = mvz / ml;
  let turnDeg = 0;
  if (bot.navLastMoveDir) {
    const dot = Math.max(-1, Math.min(1, curDirX * bot.navLastMoveDir.x + curDirZ * bot.navLastMoveDir.z));
    turnDeg = Math.acos(dot) * 57.2958;
  }
  const forcedByTurn = turnDeg >= navLearnState.forceTurnAngleDeg;
  const forcedByVertical = Math.abs(dyFromLastNode) > 0.95;
  const los = navHasLineOfSight(a.x, a.y + 0.2, a.z, p.x, p.y + 0.2, p.z);
  const nearMaxEdge = horizFromLastNode > 16.8;

  // LoS stretching: do not drop in open straight runs.
  if (los && !nearMaxEdge && !forcedByTurn && !forcedByVertical) {
    bot.navLastLearnPos = { x: p.x, y: p.y, z: p.z };
    bot.navLastMoveDir = { x: curDirX, z: curDirZ };
    return;
  }

  const idx = findOrCreateNavNode({ x: p.x, y: p.y, z: p.z });
  if (bot.navLastNode !== idx) {
    const b = nodes[idx];
    const dy = b.y - a.y;
    const t = dy > 1.0 ? 'jump' : (dy < -1.3 ? 'drop' : 'walk');
    let gain = 1;
    if (state && state.alive && camera && typeof camera.getWorldPosition === 'function') {
      const pp = new THREE.Vector3();
      camera.getWorldPosition(pp);
      const midX = (a.x + b.x) * 0.5;
      const midZ = (a.z + b.z) * 0.5;
      const pd = Math.hypot(pp.x - midX, pp.z - midZ);
      // Player-style adaptation:
      // routes near frequent player presence get reinforced more strongly.
      if (pd < 12) gain += 1.45;
      else if (pd < 20) gain += 0.95;
      else if (pd < 30) gain += 0.45;
      if (bot.target === null) gain += 0.55; // currently contesting the player
    }
    upsertNavEdge(bot.navLastNode, idx, t, gain);
    upsertNavEdge(idx, bot.navLastNode, t === 'jump' ? 'drop' : (t === 'drop' ? 'jump' : 'walk'), gain * 0.85);
  }
  bot.navLastNode = idx;
  bot.navLastLearnPos = { x: p.x, y: p.y, z: p.z };
  bot.navLastMoveDir = { x: curDirX, z: curDirZ };
}

function simplifyNavGraph() {
  ensureNavGraphLoaded();
  const g = navLearnState.graph;
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) return;
  const edges = g.edges.filter(e => {
    if (!e || e.a == null || e.b == null || e.a === e.b) return false;
    const w = Number(e.w) || 0;
    if (w <= 0) return false;
    if (!e.jump && !e.drop && w < 2) return false;
    return true;
  });
  const byA = new Map();
  for (const e of edges) {
    if (!byA.has(e.a)) byA.set(e.a, []);
    byA.get(e.a).push(e);
  }
  const kept = [];
  for (const [a, list] of byA.entries()) {
    const na = g.nodes[a];
    if (!na) continue;
    const nodeCap = getNavOutEdgeCapForNode(na);
    list.sort((e1, e2) => {
      const n1 = g.nodes[e1.b], n2 = g.nodes[e2.b];
      const d1 = n1 ? Math.hypot(n1.x - na.x, n1.z - na.z) : 9999;
      const d2 = n2 ? Math.hypot(n2.x - na.x, n2.z - na.z) : 9999;
      const s1 = (e1.w || 1) / (1 + d1 * 0.25 + (e1.jump ? 0.6 : 0));
      const s2 = (e2.w || 1) / (1 + d2 * 0.25 + (e2.jump ? 0.6 : 0));
      return s2 - s1;
    });
    const dirBins = [];
    let c = 0;
    for (const e of list) {
      if (c >= nodeCap) break;
      const nb = g.nodes[e.b];
      if (!nb) continue;
      const vx = nb.x - na.x;
      const vz = nb.z - na.z;
      const vl = Math.hypot(vx, vz) || 1;
      const ux = vx / vl;
      const uz = vz / vl;
      let dupDir = false;
      for (const d of dirBins) {
        const dot = ux * d.x + uz * d.z;
        if (dot > 0.92) { dupDir = true; break; }
      }
      if (dupDir) continue;
      dirBins.push({ x: ux, z: uz });
      kept.push(e);
      c++;
    }
  }
  // Aggressive collinear pruning via shortcuts:
  // for A->B->C that is near-straight and visible, add/boost A->C.
  const byIn = new Map();
  const byOut = new Map();
  for (const e of kept) {
    if (!byOut.has(e.a)) byOut.set(e.a, []);
    if (!byIn.has(e.b)) byIn.set(e.b, []);
    byOut.get(e.a).push(e);
    byIn.get(e.b).push(e);
  }
  for (let b = 0; b < g.nodes.length; b++) {
    const inE = byIn.get(b) || [];
    const outE = byOut.get(b) || [];
    if (!inE.length || !outE.length) continue;
    const nb = g.nodes[b];
    if (!nb) continue;
    for (const e1 of inE) {
      if (e1.jump || e1.drop) continue;
      const na = g.nodes[e1.a];
      if (!na) continue;
      const abx = nb.x - na.x, abz = nb.z - na.z;
      const abl = Math.hypot(abx, abz) || 1;
      const uabx = abx / abl, uabz = abz / abl;
      for (const e2 of outE) {
        if (e2.jump || e2.drop) continue;
        if (e1.a === e2.b) continue;
        const nc = g.nodes[e2.b];
        if (!nc) continue;
        const bcx = nc.x - nb.x, bcz = nc.z - nb.z;
        const bcl = Math.hypot(bcx, bcz) || 1;
        const ubcx = bcx / bcl, ubcz = bcz / bcl;
        const dot = uabx * ubcx + uabz * ubcz;
        if (dot < navLearnState.collinearDotMin) continue;
        const acDist = Math.hypot(nc.x - na.x, nc.z - na.z);
        if (acDist > 18) continue;
        if (!navHasLineOfSight(na.x, na.y + 0.2, na.z, nc.x, nc.y + 0.2, nc.z)) continue;
        kept.push({ a: e1.a, b: e2.b, w: Math.max(1, Math.min(e1.w || 1, e2.w || 1)), jump: false, drop: false });
      }
    }
  }

  // Final dedupe + cap pass after shortcuts.
  const uniq = new Map();
  for (const e of kept) {
    const k = `${e.a}>${e.b}`;
    const ex = uniq.get(k);
    const score = (e.w || 0) - (e.fail || 0) * 0.9;
    const exScore = ex ? ((ex.w || 0) - (ex.fail || 0) * 0.9) : -Infinity;
    if (!ex || score > exScore) uniq.set(k, e);
  }
  const finalByA = new Map();
  for (const e of uniq.values()) {
    if (!finalByA.has(e.a)) finalByA.set(e.a, []);
    finalByA.get(e.a).push(e);
  }
  const finalEdges = [];
  for (const [a, list] of finalByA.entries()) {
    const na = g.nodes[a];
    if (!na) continue;
    const nodeCap = getNavOutEdgeCapForNode(na);
    list.sort((e1, e2) => {
      const n1 = g.nodes[e1.b], n2 = g.nodes[e2.b];
      const d1 = n1 ? Math.hypot(n1.x - na.x, n1.z - na.z) : 9999;
      const d2 = n2 ? Math.hypot(n2.x - na.x, n2.z - na.z) : 9999;
      const s1 = (e1.w || 1) / (1 + d1 * 0.2);
      const s2 = (e2.w || 1) / (1 + d2 * 0.2);
      return s2 - s1;
    });
    for (let i = 0; i < Math.min(nodeCap, list.length); i++) finalEdges.push(list[i]);
  }
  g.edges = finalEdges;
  navLearnState.dirty = true;
}

function nearestNavNode(pos, maxDist = 10) {
  ensureNavGraphLoaded();
  const nodes = navLearnState.graph.nodes;
  let best = -1;
  let bestD = maxDist * maxDist;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const dx = n.x - pos.x;
    const dz = n.z - pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD) {
      bestD = d2;
      best = i;
    }
  }
  return best;
}

function edgeBetween(a, b) {
  const g = navLearnState.graph;
  if (!g || !Array.isArray(g.edges)) return null;
  for (const e of g.edges) if (e.a === a && e.b === b) return e;
  const supplemental = getSupplementalVerticalEdges();
  for (const e of supplemental) if (e.a === a && e.b === b) return e;
  return null;
}

function markNavFallHazard(bot) {
  ensureNavGraphLoaded();
  const g = navLearnState.graph;
  if (!g || !Array.isArray(g.nodes)) return;
  const morpheus = currentMap === 2;
  const p = bot && bot.mesh && bot.mesh.position ? bot.mesh.position : null;

  if (typeof bot.navLastNode === 'number' && bot.navLastNode >= 0 && g.nodes[bot.navLastNode]) {
    const n = g.nodes[bot.navLastNode];
    n.fallRisk = Math.min(14, (n.fallRisk || 0) + (morpheus ? 2.2 : 1.5));
  }
  const re = bot.navRecentEdge;
  if (re && Number.isFinite(re.a) && Number.isFinite(re.b)) {
    const e = edgeBetween(re.a, re.b);
    if (e) {
      e.fail = Math.min(20, (e.fail || 0) + (morpheus ? 3.2 : 2.2));
      if (!bot.navFailMem) bot.navFailMem = {};
      const key = `${re.a}>${re.b}`;
      const cur = Number(bot.navFailMem[key]) || 0;
      bot.navFailMem[key] = Math.min(10, cur + (morpheus ? 2.4 : 1.8));
    }
  }

  // DM-Morpheus: bots often die without an active nav path (graph sparse or navDesiredDirection null).
  // Tie void deaths to the nearest learned nodes at the actual fall position so pathfinding can react.
  if (morpheus && p && g.nodes.length) {
    const ranked = [];
    for (let i = 0; i < g.nodes.length; i++) {
      const n = g.nodes[i];
      if (!n) continue;
      const dy = Math.abs((n.y || 0) - p.y);
      const d = Math.hypot(n.x - p.x, n.z - p.z) + dy * 0.4;
      ranked.push({ i, d });
    }
    ranked.sort((a, b) => a.d - b.d);
    const maxD = 30;
    const kMax = 6;
    for (let k = 0; k < Math.min(kMax, ranked.length); k++) {
      if (ranked[k].d > maxD) break;
      const n = g.nodes[ranked[k].i];
      if (!n) continue;
      const falloff = 1 - ranked[k].d / (maxD + 0.01);
      n.fallRisk = Math.min(14, (n.fallRisk || 0) + 2.6 * falloff);
    }
  }

  navLearnState.dirty = true;
  if (morpheus) {
    try { saveNavGraph(); } catch (_) {}
  }
}

function markNavStuckHazard(bot, strength = 1) {
  ensureNavGraphLoaded();
  const g = navLearnState.graph;
  if (!g || !g.nodes || !g.edges || !bot) return;
  const gain = Math.max(0.35, Math.min(3.2, Number(strength) || 1));
  if (Number.isFinite(bot.navLastNode) && bot.navLastNode >= 0 && g.nodes[bot.navLastNode]) {
    const n = g.nodes[bot.navLastNode];
    n.stuckRisk = Math.min(14, (n.stuckRisk || 0) + gain * 0.95);
  }
  const re = bot.navRecentEdge;
  if (re && Number.isFinite(re.a) && Number.isFinite(re.b)) {
    const e = edgeBetween(re.a, re.b);
    if (e) {
      e.fail = Math.min(20, (e.fail || 0) + gain * 1.15);
      if (!bot.navFailMem) bot.navFailMem = {};
      const key = `${re.a}>${re.b}`;
      const cur = Number(bot.navFailMem[key]) || 0;
      bot.navFailMem[key] = Math.min(10, cur + gain * 0.9);
    }
  }
  navLearnState.dirty = true;
}

function pathfindNodes(start, goal) {
  const g = navLearnState.graph;
  if (!g || !g.nodes || !g.edges || start < 0 || goal < 0) return null;
  const N = g.nodes.length;
  if (start >= N || goal >= N) return null;
  const open = [start];
  const came = new Array(N).fill(-1);
  const gScore = new Array(N).fill(Infinity);
  const fScore = new Array(N).fill(Infinity);
  gScore[start] = 0;
  fScore[start] = 0;
  const adj = new Map();
  for (const e of g.edges) {
    if (!adj.has(e.a)) adj.set(e.a, []);
    adj.get(e.a).push(e);
  }
  const supplemental = getSupplementalVerticalEdges();
  for (const e of supplemental) {
    if (!adj.has(e.a)) adj.set(e.a, []);
    adj.get(e.a).push(e);
  }
  while (open.length) {
    let oi = 0;
    for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[oi]]) oi = i;
    const cur = open.splice(oi, 1)[0];
    if (cur === goal) {
      const out = [cur];
      let c = cur;
      while (came[c] >= 0) {
        c = came[c];
        out.push(c);
      }
      out.reverse();
      return out;
    }
    const edges = adj.get(cur) || [];
    for (const e of edges) {
      const n = e.b;
      const a = g.nodes[cur], b = g.nodes[n];
      const fr = (b && b.fallRisk) ? b.fallRisk : 0;
      const sr = (b && b.stuckRisk) ? b.stuckRisk * 0.9 : 0;
      const fallMul = currentMap === 2 ? 1.55 : 1;
      const nodeRisk = fr * fallMul + sr;
      const edgeFail = e && e.fail ? e.fail : 0;
      if (edgeFail >= 8) continue;
      const dist = Math.hypot(b.x - a.x, b.z - a.z);
      const confidencePenalty = 1 + (1 / Math.max(1, e.w || 1)) * 0.75;
      const verticalPenalty = (e.jump ? 2.2 : 0) + (e.drop ? 0.8 : 0);
      const dropPenalty = currentMap === 2 && e.drop ? 1.1 : 0;
      const hazardPenalty = edgeFail * 1.8 + nodeRisk * 1.1 + dropPenalty;
      const centerBonus = flatArenaCenterWeight(b.x, b.z) * 1.8;
      const step = Math.max(0.5, dist * confidencePenalty + verticalPenalty + hazardPenalty - centerBonus);
      const tentative = gScore[cur] + step;
      if (tentative >= gScore[n]) continue;
      came[n] = cur;
      gScore[n] = tentative;
      const h = Math.hypot(g.nodes[goal].x - b.x, g.nodes[goal].z - b.z);
      fScore[n] = tentative + h;
      if (!open.includes(n)) open.push(n);
    }
  }
  return null;
}

function getBotEdgeFailPenalty(bot, a, b) {
  if (!bot || !bot.navFailMem) return 0;
  const key = `${a}>${b}`;
  return Number(bot.navFailMem[key]) || 0;
}

function decayBotFailMemory(bot, dt) {
  if (!bot || !bot.navFailMem) return;
  const mem = bot.navFailMem;
  const keys = Object.keys(mem);
  if (!keys.length) return;
  const decay = Math.max(0.0025, dt * 0.22);
  for (const k of keys) {
    const v = (Number(mem[k]) || 0) - decay;
    if (v <= 0.02) delete mem[k];
    else mem[k] = v;
  }
}

function pathfindNodesForBot(bot, start, goal) {
  const basePath = pathfindNodes(start, goal);
  if (!bot || !basePath || basePath.length < 2) return basePath;
  if (!bot.navFailMem || Object.keys(bot.navFailMem).length === 0) return basePath;

  const g = navLearnState.graph;
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) return basePath;
  const N = g.nodes.length;
  if (start < 0 || goal < 0 || start >= N || goal >= N) return basePath;

  const open = [start];
  const came = new Array(N).fill(-1);
  const gScore = new Array(N).fill(Infinity);
  const fScore = new Array(N).fill(Infinity);
  gScore[start] = 0;
  fScore[start] = 0;
  const adj = new Map();
  for (const e of g.edges) {
    if (!adj.has(e.a)) adj.set(e.a, []);
    adj.get(e.a).push(e);
  }
  for (const e of getSupplementalVerticalEdges()) {
    if (!adj.has(e.a)) adj.set(e.a, []);
    adj.get(e.a).push(e);
  }

  while (open.length) {
    let oi = 0;
    for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[oi]]) oi = i;
    const cur = open.splice(oi, 1)[0];
    if (cur === goal) {
      const out = [cur];
      let c = cur;
      while (came[c] >= 0) {
        c = came[c];
        out.push(c);
      }
      out.reverse();
      return out;
    }
    const edges = adj.get(cur) || [];
    for (const e of edges) {
      const n = e.b;
      const a = g.nodes[cur];
      const b = g.nodes[n];
      if (!a || !b) continue;
      const fr = (b && b.fallRisk) ? b.fallRisk : 0;
      const sr = (b && b.stuckRisk) ? b.stuckRisk * 0.9 : 0;
      const fallMul = currentMap === 2 ? 1.55 : 1;
      const nodeRisk = fr * fallMul + sr;
      const edgeFail = e && e.fail ? e.fail : 0;
      if (edgeFail >= 8) continue;
      const dist = Math.hypot(b.x - a.x, b.z - a.z);
      const confidencePenalty = 1 + (1 / Math.max(1, e.w || 1)) * 0.75;
      const verticalPenalty = (e.jump ? 2.2 : 0) + (e.drop ? 0.8 : 0);
      const dropPenalty = currentMap === 2 && e.drop ? 1.1 : 0;
      const hazardPenalty = edgeFail * 1.8 + nodeRisk * 1.1 + dropPenalty;
      const botFailPenalty = getBotEdgeFailPenalty(bot, cur, n) * (e.jump || e.drop ? 3.2 : 1.15);
      const centerBonus = flatArenaCenterWeight(b.x, b.z) * 1.4;
      const step = Math.max(0.5, dist * confidencePenalty + verticalPenalty + hazardPenalty + botFailPenalty - centerBonus);
      const tentative = gScore[cur] + step;
      if (tentative >= gScore[n]) continue;
      came[n] = cur;
      gScore[n] = tentative;
      const h = Math.hypot(g.nodes[goal].x - b.x, g.nodes[goal].z - b.z);
      fScore[n] = tentative + h;
      if (!open.includes(n)) open.push(n);
    }
  }
  return basePath;
}

function pickGoalNodeForTarget(bot, targetPos) {
  ensureNavGraphLoaded();
  const g = navLearnState.graph;
  if (!g || !Array.isArray(g.nodes) || g.nodes.length < 2) return nearestNavNode(targetPos, 18);
  const bp = bot && bot.mesh ? bot.mesh.position : targetPos;
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < g.nodes.length; i++) {
    const n = g.nodes[i];
    if (!n) continue;
    const dTargetXZ = Math.hypot(n.x - targetPos.x, n.z - targetPos.z);
    if (dTargetXZ > 28) continue;
    const dTargetY = Math.abs(n.y - targetPos.y);
    const dBotXZ = Math.hypot(n.x - bp.x, n.z - bp.z);
    const score = dTargetXZ + dTargetY * 1.35 + dBotXZ * 0.08;
    const tierBias = dTargetY < 1.2 ? -1.0 : 0;
    const finalScore = score + tierBias;
    if (finalScore < bestScore) {
      bestScore = finalScore;
      best = i;
    }
  }
  if (best >= 0) return best;
  return nearestNavNode(targetPos, 18);
}

function navDesiredDirection(bot, targetPos) {
  ensureNavGraphLoaded();
  const g = navLearnState.graph;
  if (!g || g.nodes.length < 6 || g.edges.length < 8) return null;
  if (currentMap === 2 && !morpheusNavGraphReady()) return null;
  bot.navRepathTimer = (bot.navRepathTimer || 0) - 0.016;
  const start = nearestNavNode(bot.mesh.position, 18);
  const goal = pickGoalNodeForTarget(bot, targetPos);
  if (start < 0 || goal < 0) return null;
  let plannedGoal = goal;
  const transition = chooseLayerTransitionNode(bot, start, goal, targetPos);
  if (transition >= 0 && transition !== start) plannedGoal = transition;

  if (!bot.navPath || bot.navPath.length < 2 || bot.navGoalNode !== plannedGoal || bot.navRepathTimer <= 0) {
    bot.navPath = pathfindNodesForBot(bot, start, plannedGoal);
    bot.navStep = 1;
    bot.navGoalNode = plannedGoal;
    bot.navRepathTimer = 0.6 + Math.random() * 0.5;
  }
  if (!bot.navPath || bot.navPath.length < 2) {
    const anchor = g.nodes[goal] || g.nodes[start];
    if (!anchor) return null;
    const hook = new THREE.Vector3(anchor.x - bot.mesh.position.x, 0, anchor.z - bot.mesh.position.z);
    if (hook.lengthSq() < 0.25) return null;
    hook.normalize();
    bot.navTargetNode = goal;
    return hook;
  }
  let step = Math.min(bot.navStep || 1, bot.navPath.length - 1);
  let nextIdx = bot.navPath[step];
  let n = g.nodes[nextIdx];
  if (!n) return null;
  // Crowd-aware progression: if many bots pursue same node, relax reach radius.
  let crowd = 0;
  for (const ob of bots) {
    if (!ob || ob === bot || !ob.alive) continue;
    if (ob.navTargetNode === nextIdx) crowd++;
  }
  const to = new THREE.Vector3(n.x - bot.mesh.position.x, 0, n.z - bot.mesh.position.z);
  const reachSq = crowd >= 2 ? 16 : (crowd >= 1 ? 9 : 4);
  if (to.lengthSq() < reachSq && step < bot.navPath.length - 1) {
    step++;
    bot.navStep = step;
    nextIdx = bot.navPath[step];
    n = g.nodes[nextIdx] || n;
  }
  bot.navTargetNode = nextIdx;
  const curIdx = bot.navPath[Math.max(0, step - 1)];
  const edge = edgeBetween(curIdx, nextIdx);
  bot.navRecentEdge = { a: curIdx, b: nextIdx };
  // Morpheus: do not commit to surface-following nav if the next step leaves solid ground (geometry-first).
  if (currentMap === 2 && edge && bot.onSurface && !edge.jump) {
    if (!morpheusNavHorizStepLooksSafe(bot, n)) {
      edge.fail = Math.min(20, (edge.fail || 0) + 1.65);
      return null;
    }
  }
  if (edge && edge.jump && bot.onSurface) {
    // Do not jump if the target node appears to sit over unsafe ground.
    if (!hasSupportAt(n.x, n.z, n.y + BOT_HEIGHT * 0.5, currentMap === 2 ? 0.75 : 1.0)) {
      edge.fail = Math.min(20, (edge.fail || 0) + 1.3);
      return null;
    }
    const jumpFail = edge.fail || 0;
    if (jumpFail > 6) return null;
    const dy = Math.max(0, (n.y - bot.mesh.position.y) + 0.28);
    const needVy = Math.sqrt(Math.max(0.1, 2 * Math.abs(GRAVITY) * dy));
    const minVy = JUMP_SPEED * 0.72;
    const maxVy = JUMP_SPEED * 1.04;
    if (needVy > maxVy + 0.18) {
      // Mark this edge as bad when the vertical request is physically unrealistic.
      edge.fail = Math.min(20, (edge.fail || 0) + 1.6);
      return null;
    }
    bot.velY = Math.max(minVy, Math.min(maxVy, needVy));
    bot.onSurface = false;
  }
  to.normalize();
  return to;
}

function setNavTraining(active) {
  navLearnState.training = !!active;
  ensureNavGraphLoaded();
  if (navLearnState.training) {
    navLearnState.bootstrapActive = true;
    navLearnState.bootstrapStartMs = performance.now();
    navLearnState.minLearnMove = navLearnState.bootstrapConfig.minLearnMove;
    navLearnState.nodeRadiusXZ = navLearnState.bootstrapConfig.nodeRadiusXZ;
    navLearnState.maxOutEdgesPerNode = navLearnState.bootstrapConfig.maxOutEdgesPerNode;
    navLearnState.forceTurnAngleDeg = navLearnState.bootstrapConfig.forceTurnAngleDeg;
    simplifyNavGraph();
    for (const b of bots) {
      if (!b) continue;
      b.alive = true;
      b.mesh.visible = true;
      if (!Number.isFinite(b.mesh.position.y)) {
        const sp = randomSpawn();
        b.mesh.position.set(sp[0], sp[1], sp[2]);
      }
      b.navLastNode = -1;
      b.navPath = null;
      b.navStep = 1;
      b.navGoalNode = -1;
      b.navTargetNode = -1;
      b.navRepathTimer = 0;
      b.navRecentEdge = null;
    }
  } else {
    navLearnState.bootstrapActive = false;
    navLearnState.minLearnMove = navLearnState.stableConfig.minLearnMove;
    navLearnState.nodeRadiusXZ = navLearnState.stableConfig.nodeRadiusXZ;
    navLearnState.maxOutEdgesPerNode = navLearnState.stableConfig.maxOutEdgesPerNode;
    navLearnState.forceTurnAngleDeg = navLearnState.stableConfig.forceTurnAngleDeg;
    saveNavGraph();
  }
  renderNavOverlay(true);
}

function isNavTraining() {
  return !!navLearnState.training;
}

function clearNavOverlayMeshes() {
  if (!navOverlayState.group) return;
  while (navOverlayState.group.children.length) {
    const c = navOverlayState.group.children.pop();
    navOverlayState.group.remove(c);
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
  }
}

function renderNavOverlay(force = false) {
  if (!navOverlayState.visible) return;
  ensureNavGraphLoaded();
  const now = performance.now();
  if (!force && now - navOverlayState.lastRenderAt < 240 && !navLearnState.dirty) return;
  navOverlayState.lastRenderAt = now;
  navLearnState.dirty = false;
  if (!navOverlayState.group) {
    navOverlayState.group = new THREE.Group();
    navOverlayState.group.name = 'NavLearnOverlay';
    scene.add(navOverlayState.group);
  }
  clearNavOverlayMeshes();
  const g = navLearnState.graph;
  if (!g || !g.nodes || !g.edges || !g.nodes.length) return;

  const nodePos = new Float32Array(g.nodes.length * 3);
  for (let i = 0; i < g.nodes.length; i++) {
    nodePos[i * 3] = g.nodes[i].x;
    nodePos[i * 3 + 1] = g.nodes[i].y + 0.12;
    nodePos[i * 3 + 2] = g.nodes[i].z;
  }
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
  const nodePts = new THREE.Points(nodeGeo, new THREE.PointsMaterial({
    color: 0x8ef6ff, size: 0.32, sizeAttenuation: true, depthWrite: false, transparent: true, opacity: 0.95,
  }));
  navOverlayState.group.add(nodePts);

  // Confidence-weighted edge render:
  // stronger / safer / frequently-used edges are thicker and brighter.
  const rankedEdges = [];
  let maxScore = 0.01;
  for (const e of g.edges) {
    const a = g.nodes[e.a];
    const b = g.nodes[e.b];
    if (!a || !b) continue;
    const w = Math.max(0.01, Number(e.w) || 0.01);
    const fail = Math.max(0, Number(e.fail) || 0);
    const verticalPenalty = e.jump ? 0.26 : (e.drop ? 0.12 : 0);
    const score = w / (1 + fail * 0.9 + verticalPenalty);
    if (score > maxScore) maxScore = score;
    rankedEdges.push({ e, a, b, score });
  }
  if (!rankedEdges.length) return;

  rankedEdges.sort((x, y) => y.score - x.score);
  const drawCap = Math.max(140, Math.min(520, rankedEdges.length));
  const keepThreshold = rankedEdges[Math.min(rankedEdges.length - 1, drawCap - 1)].score * 0.92;
  const filtered = rankedEdges.filter(it => it.score >= keepThreshold).slice(0, drawCap);

  function addWeightedEdge(a, b, e, norm) {
    const ax = a.x, ay = a.y + 0.07, az = a.z;
    const bx = b.x, by = b.y + 0.07, bz = b.z;
    const vx = bx - ax, vy = by - ay, vz = bz - az;
    const len = Math.hypot(vx, vy, vz);
    if (len < 0.05) return;
    const radius = 0.03 + norm * 0.14;
    const color = e.jump ? 0x7dff9a : (e.drop ? 0xffbf6d : 0x6cb6ff);
    const alpha = 0.18 + norm * 0.78;
    const geo = new THREE.CylinderGeometry(radius, radius, len, 7, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: alpha,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
    const dir = new THREE.Vector3(vx / len, vy / len, vz / len);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    navOverlayState.group.add(mesh);
  }

  for (const it of filtered) {
    const norm = Math.max(0.05, Math.min(1, it.score / maxScore));
    addWeightedEdge(it.a, it.b, it.e, norm);
  }
}

function setNavOverlayVisible(active) {
  navOverlayState.visible = !!active;
  if (!navOverlayState.visible) {
    if (navOverlayState.group) {
      clearNavOverlayMeshes();
      scene.remove(navOverlayState.group);
      navOverlayState.group = null;
    }
    return;
  }
  renderNavOverlay(true);
}

function isNavOverlayVisible() {
  return !!navOverlayState.visible;
}

/** DM-Morpheus: only trust learned nav after the graph has enough coverage; else use geometry-first movement. */
function morpheusNavGraphReady() {
  if (currentMap !== 2) return true;
  ensureNavGraphLoaded();
  const g = navLearnState.graph;
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) return false;
  if (g.nodes.length < 12 || g.edges.length < 18) return false;
  const comp = navCompletion();
  return (comp.score >= 24);
}

/**
 * Sample foot positions along the horizontal move toward `nextNode`; reject if we would leave solid ground (void).
 * Used on Morpheus for walk + drop nav edges before committing to graph direction.
 */
function morpheusNavHorizStepLooksSafe(bot, nextNode) {
  if (currentMap !== 2 || !bot || !bot.mesh || !nextNode) return true;
  const bp = bot.mesh.position;
  const feetY = bp.y - BOT_HEIGHT * 0.5;
  const dx = nextNode.x - bp.x;
  const dz = nextNode.z - bp.z;
  const hLen = Math.hypot(dx, dz) || 1;
  const ux = dx / hLen;
  const uz = dz / hLen;
  for (const dist of [0.45, 1.0, 1.65]) {
    const px = bp.x + ux * Math.min(dist, hLen + 0.01);
    const pz = bp.z + uz * Math.min(dist, hLen + 0.01);
    const top = morpheusSupportTopAtFeet(px, pz, feetY + 0.55);
    if (top < -200) return false;
    if (top < feetY - 1.85) return false;
  }
  return true;
}

function navCompletion() {
  ensureNavGraphLoaded();
  const bounds = (MAP_BOUNDS && MAP_BOUNDS[currentMap]) ? MAP_BOUNDS[currentMap] : [60, 60];
  const area = Math.max(1, (bounds[0] * 2) * (bounds[1] * 2));
  const targetNodes = Math.max(24, Math.floor(area / 220));
  const targetEdges = Math.max(40, Math.floor(targetNodes * 2.2));
  const n = navLearnState.graph.nodes.length;
  const e = navLearnState.graph.edges.length;
  const nodeScore = Math.min(1, n / targetNodes);
  const edgeScore = Math.min(1, e / targetEdges);
  const score = Math.round((nodeScore * 0.55 + edgeScore * 0.45) * 100);
  return { score, targetNodes, targetEdges };
}

function bakeNavNow() {
  ensureNavGraphLoaded();
  saveNavGraph();
  renderNavOverlay(true);
  return navStatus();
}

function navStatus() {
  ensureNavGraphLoaded();
  const comp = navCompletion();
  let jumpEdges = 0;
  let dropEdges = 0;
  if (navLearnState.graph && Array.isArray(navLearnState.graph.edges)) {
    for (const e of navLearnState.graph.edges) {
      if (e.jump) jumpEdges++;
      if (e.drop) dropEdges++;
    }
  }
  return {
    training: !!navLearnState.training,
    alwaysLearn: !!navLearnState.alwaysLearn,
    overlay: !!navOverlayState.visible,
    nodes: navLearnState.graph && navLearnState.graph.nodes ? navLearnState.graph.nodes.length : 0,
    edges: navLearnState.graph && navLearnState.graph.edges ? navLearnState.graph.edges.length : 0,
    jumpEdges,
    dropEdges,
    completion: comp.score,
    targetNodes: comp.targetNodes,
    targetEdges: comp.targetEdges,
    mapKey: navLearnState.mapKey,
  };
}

window.__TA_NAV_SET_TRAINING = setNavTraining;
window.__TA_NAV_IS_TRAINING = isNavTraining;
window.__TA_NAV_STATUS = navStatus;
window.__TA_NAV_SET_OVERLAY = setNavOverlayVisible;
window.__TA_NAV_IS_OVERLAY = isNavOverlayVisible;
window.__TA_NAV_BAKE_NOW = bakeNavNow;
window.__TA_NAV_SET_ALWAYS_LEARN = setAlwaysLearn;
window.__TA_NAV_GET_ALWAYS_LEARN = isAlwaysLearn;
window.__TA_BOT_NAV_DEBUG_SET = setBotNavDebugOverlay;
window.__TA_BOT_NAV_DEBUG_GET = getBotNavDebugOverlay;

/** Reused for muzzle point (no alloc per shot) */
const tmpBotMuzzle = new THREE.Vector3();

// Skill per bot (0 = worst, 1 = best) — reaction time, accuracy, prediction
const BOT_SKILLS = [0.75, 0.65, 0.55, 0.60, 0.45, 0.70, 0.50, 0.35];
// Xan  Loque  Tamika  Kragoth  Cali  Malcolm  Dominator  Devastator

const BOT_NAMES = ['Xan', 'Loque', 'Tamika', 'Kragoth', 'Cali', 'Malcolm', 'Dominator', 'Devastator'];
const BOT_PERSONALITIES = ['aggressive', 'cautious', 'flanker', 'duelist', 'rusher'];

const BOT_COLORS = [
  { body: 0xcc2244, head: 0xdd3355, visor: 0x00ffaa },
  { body: 0x2255cc, head: 0x3366dd, visor: 0xffaa00 },
  { body: 0x22cc55, head: 0x33dd66, visor: 0xff6600 },
  { body: 0xcc8822, head: 0xddaa33, visor: 0x0088ff },
  { body: 0xcc22aa, head: 0xdd33cc, visor: 0x88ff00 },
  { body: 0x888888, head: 0xaaaaaa, visor: 0xff0044 },
  { body: 0x44aaaa, head: 0x55cccc, visor: 0xff4400 },
  { body: 0xcc5500, head: 0xdd6611, visor: 0x00ff88 },
];

// ── Bot mesh (optional GLB in models/arena/, else procedural arena fighter) ───

/** Empty = procedural bots only. E.g. ['duelist_a.glb'] when you add assets. */
const BOT_GLB_NAMES = [];

function resolveBotModelUrl(filename) {
  try {
    return new URL(`./models/arena/${filename}`, document.baseURI).href;
  } catch (_) {
    return `models/arena/${filename}`;
  }
}

/** Addon script may finish after defer start — wait briefly for GLTFLoader. */
function waitForGLTFLoader(maxMs = 4000) {
  return new Promise(resolve => {
    const t0 = performance.now();
    function tick() {
      if (typeof window.GLTFLoader === 'function') {
        resolve(window.GLTFLoader);
        return;
      }
      if (performance.now() - t0 >= maxMs) {
        resolve(null);
        return;
      }
      setTimeout(tick, 16);
    }
    tick();
  });
}

/** Shock-rifle-style weapon (Instagib colors); loop + muzzle for beam origin. */
function buildBotInstagibWeapon(darkMat, barrelMat) {
  const weapon = new THREE.Group();
  weapon.name = 'instagib';

  const coilGlow = new THREE.MeshStandardMaterial({
    color: 0xff3344,
    emissive: 0xff1111,
    emissiveIntensity: 0.95,
    roughness: 0.18,
    metalness: 0.88,
  });

  // Right hand: barrel along local +Z so bots visually point forward.
  weapon.position.set(0.42, 1.24, 0.01);
  weapon.rotation.set(0.04, 0, -0.08);

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x4e445e,
    emissive: 0x1a1220,
    emissiveIntensity: 0.2,
    roughness: 0.28,
    metalness: 0.9,
  });

  // Rear stock + battery.
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.24), darkMat);
  stock.position.set(0, 0, -0.24);
  weapon.add(stock);
  const battery = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.14), trimMat);
  battery.position.set(0, -0.02, -0.38);
  weapon.add(battery);

  // Main receiver.
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.44), barrelMat);
  body.position.set(0, 0, -0.02);
  weapon.add(body);

  // Twin glow coils for a stronger futuristic silhouette.
  const coilL = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 8, 20), coilGlow);
  const coilR = coilL.clone();
  coilL.rotation.x = Math.PI / 2;
  coilR.rotation.x = Math.PI / 2;
  coilL.position.set(-0.055, 0.02, 0.12);
  coilR.position.set(0.055, 0.02, 0.12);
  weapon.add(coilL, coilR);

  // Front barrel shroud + muzzle.
  const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.24), trimMat);
  shroud.position.set(0, 0, 0.28);
  weapon.add(shroud);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.34, 10), barrelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, 0.46);
  weapon.add(barrel);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), coilGlow);
  tip.position.set(0, 0, 0.66);
  weapon.add(tip);

  const muzzle = new THREE.Object3D();
  muzzle.name = 'instagibMuzzle';
  muzzle.position.set(0, 0, 0.74);
  weapon.add(muzzle);

  return { weapon, muzzle };
}

/** Skinned GLB: rest pose + bounds; avoids “helmet only” from bad culling/bounds. */
function fitAndGroundBotRoot(root) {
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (o.isSkinnedMesh && o.skeleton) {
      try {
        if (typeof o.skeleton.pose === 'function') o.skeleton.pose();
        o.skeleton.update();
      } catch (_) {}
      o.frustumCulled = false;
      if (o.geometry) {
        o.geometry.computeBoundingBox();
        o.geometry.computeBoundingSphere();
      }
    } else if (o.isMesh) {
      o.frustumCulled = false;
      if (o.geometry) {
        o.geometry.computeBoundingBox();
        o.geometry.computeBoundingSphere();
      }
    }
  });
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  let sy = size.y;
  if (!Number.isFinite(sy) || sy < 0.08) sy = 1.8;
  const scale = (BOT_HEIGHT * 0.92) / sy;
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  if (!box2.isEmpty() && Number.isFinite(box2.min.y)) root.position.y -= box2.min.y;
}

/**
 * UT99 / Q3-style armored humanoid + hierarchy for walk/idle (leg/arm pivots).
 * `outer.position` = world **center** (same as player / resolveBoxCollision), not the feet.
 */
function createProceduralBotMesh(idx) {
  const c = BOT_COLORS[idx % BOT_COLORS.length];
  const colBody = new THREE.Color(c.body);
  const colHead = new THREE.Color(c.head);

  const armor = new THREE.MeshStandardMaterial({
    color: c.body,
    emissive: colBody.clone().multiplyScalar(0.12),
    roughness: 0.38,
    metalness: 0.72,
  });
  const joint = new THREE.MeshStandardMaterial({
    color: 0x2a2830,
    emissive: new THREE.Color(0x0a080c),
    roughness: 0.55,
    metalness: 0.55,
  });
  const plate = new THREE.MeshStandardMaterial({
    color: c.head,
    emissive: colHead.clone().multiplyScalar(0.18),
    roughness: 0.32,
    metalness: 0.78,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: c.visor,
    emissive: new THREE.Color(c.visor),
    emissiveIntensity: 0.85,
    roughness: 0.12,
    metalness: 0.92,
  });
  const darkTrim = new THREE.MeshStandardMaterial({
    color: 0x18161c,
    roughness: 0.45,
    metalness: 0.65,
  });

  const outer = new THREE.Group();
  const animRoot = new THREE.Group();
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  const core = new THREE.Group();
  const headG = new THREE.Group();

  const hipY = 1.02;
  legL.position.set(-0.14, hipY, 0.06);
  legR.position.set(0.14, hipY, 0.06);
  armL.position.set(-0.58, 1.5, 0.06);
  armR.position.set(0.58, 1.5, 0.06);
  headG.position.set(0, 1.98, -0.02);

  function cylAdd(par, r0, r1, h, mat, x, y, z, rx = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 10, 1), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    par.add(m);
    return m;
  }

  function boxAdd(par, sx, sy, sz, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    par.add(m);
    return m;
  }

  // ── Legs (local to hip) ──
  [legL, legR].forEach(leg => {
    boxAdd(leg, 0.22, 0.12, 0.34, darkTrim, 0, 0.06 - hipY, 0);
    cylAdd(leg, 0.11, 0.09, 0.38, armor, 0, 0.28 - hipY, 0);
    cylAdd(leg, 0.1, 0.08, 0.36, joint, 0, 0.62 - hipY, 0);
    cylAdd(leg, 0.13, 0.11, 0.42, armor, 0, 0.95 - hipY, 0);
  });

  // Torso / hip / shoulders / back
  boxAdd(core, 0.52, 0.18, 0.28, plate, 0, 1.18, 0);
  boxAdd(core, 0.56, 0.52, 0.34, armor, 0, 1.52, 0.02, 0.06, 0, 0);
  boxAdd(core, 0.42, 0.22, 0.26, darkTrim, 0, 1.28, 0.08);
  [[-0.44, 1.62, 0], [0.44, 1.62, 0]].forEach(([x, y, z]) => {
    boxAdd(core, 0.26, 0.2, 0.34, plate, x, y, z, 0, 0, 0.22 * Math.sign(x));
  });
  boxAdd(core, 0.28, 0.36, 0.16, darkTrim, 0, 1.55, -0.2);
  cylAdd(core, 0.16, 0.2, 0.12, joint, 0, 1.78, -0.02);

  // Arms (local to shoulder pivot)
  [[armL, -1], [armR, 1]].forEach(([arm, sgn]) => {
    cylAdd(arm, 0.1, 0.09, 0.28, joint, 0, -0.02, 0, 0.35 * sgn, 0);
    cylAdd(arm, 0.09, 0.08, 0.32, armor, sgn * 0.07, -0.28, -0.02, 0.25 * sgn, 0);
    boxAdd(arm, 0.14, 0.12, 0.22, darkTrim, sgn * 0.12, -0.52, -0.04);
  });

  // Head (relative to headG)
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), armor);
  helm.scale.set(1.05, 1.12, 1.02);
  helm.position.set(0, 0, 0);
  headG.add(helm);
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.36), plate);
  crest.position.set(0, 0.14, -0.16);
  headG.add(crest);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.18), visorMat);
  visor.position.set(0, -0.02, 0.24);
  headG.add(visor);

  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x353042,
    emissive: 0x1a1020,
    emissiveIntensity: 0.12,
    roughness: 0.32,
    metalness: 0.9,
  });
  const { weapon, muzzle } = buildBotInstagibWeapon(darkTrim, barrelMat);
  animRoot.add(legL, legR, armL, armR, core, headG, weapon);
  outer.add(animRoot);
  outer.userData.weaponMuzzle = muzzle;

  animRoot.updateMatrixWorld(true);
  const bb0 = new THREE.Box3().setFromObject(animRoot);
  const cy = (bb0.min.y + bb0.max.y) * 0.5;
  animRoot.position.y = -cy;

  const h = bb0.getSize(new THREE.Vector3()).y;
  const s = (Number.isFinite(h) && h > 0.1) ? BOT_HEIGHT / h : 1;
  outer.scale.setScalar(s);
  // Slightly slimmer silhouette so bots read less oversized at equal collision height.
  outer.scale.x *= 0.94;
  outer.scale.z *= 0.94;

  // Feet exactly at y = -BOT_HEIGHT/2 w.r.t. outer (center = collision center), no visual “hover”
  outer.updateMatrixWorld(true);
  const bbFoot = new THREE.Box3().setFromObject(animRoot);
  const sy = outer.scale.x;
  animRoot.position.y += (-BOT_HEIGHT * 0.5 - bbFoot.min.y) / sy;

  const hitbox = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.75, 2.0, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.set(0, 0, 0);
  outer.add(hitbox);

  outer.userData.proceduralPose = {
    animRoot, legL, legR, armL, armR, core, headG,
    baseY: animRoot.position.y,
    phase: Math.random() * Math.PI * 2,
    idlePhase: Math.random() * Math.PI * 2,
  };

  outer.traverse(child => { if (child.isMesh) child.castShadow = true; });
  return outer;
}

window.createProceduralBotMesh = createProceduralBotMesh;

/**
 * Procedural bob / walk / air pose for a mesh from `createProceduralBotMesh`.
 * Used by AI bots and multiplayer remote pawns (authoritative onGround + speed).
 */
function applyProceduralPoseToMesh(mesh, dt, animSpeed, onGround, alive) {
  const pose = mesh.userData.proceduralPose;
  if (!pose || !alive) return;

  const moving = (animSpeed > 0.35) && onGround;
  const air = !onGround;

  pose.phase += dt * (moving ? Math.min(animSpeed * 0.5, 12) : 1.1);
  pose.idlePhase += dt * 1.8;

  const p = pose.phase;
  const idle = pose.idlePhase;
  const w = moving ? 1 : 0.22;
  const stride = moving ? Math.sin(p) : 0;
  const stride2 = moving ? Math.sin(p * 2) : 0;

  const baseY = Number.isFinite(pose.baseY) ? pose.baseY : 0;
  const bob = Math.sin(p * 2) * 0.022 * w + Math.sin(idle) * 0.008;
  pose.animRoot.position.y = baseY + bob + (air ? Math.sin(performance.now() * 0.008) * 0.04 : 0);
  pose.animRoot.rotation.z = Math.sin(p) * 0.055 * w;
  pose.animRoot.rotation.x = stride2 * 0.045 * w;

  if (moving) {
    pose.legL.rotation.x = stride * 0.42;
    pose.legR.rotation.x = -stride * 0.42;
    pose.armL.rotation.x = -stride * 0.32;
    pose.armR.rotation.x = stride * 0.32;
    pose.core.rotation.x = stride2 * 0.055;
    pose.headG.rotation.x = -stride2 * 0.035;
    pose.headG.rotation.y = 0;
  } else {
    const damp = 1 - Math.min(1, dt * 10);
    pose.legL.rotation.x *= damp;
    pose.legR.rotation.x *= damp;
    pose.armL.rotation.x *= damp;
    pose.armR.rotation.x *= damp;
    pose.core.rotation.x *= damp;
    pose.headG.rotation.x = Math.sin(idle) * 0.04;
    pose.headG.rotation.y = Math.sin(idle * 0.7) * 0.025;
  }

  if (air) {
    pose.legL.rotation.x = 0.55;
    pose.legR.rotation.x = -0.35;
    pose.armL.rotation.x = -0.5;
    pose.armR.rotation.x = 0.5;
    pose.headG.rotation.y = 0;
  }

  const emote = pose.emote;
  if (emote && emote.time > 0) {
    emote.time = Math.max(0, emote.time - dt);
    const tNorm = emote.duration > 0 ? (1 - emote.time / emote.duration) : 1;
    const pulse = Math.sin(tNorm * Math.PI * (emote.cycles || 1));
    const amp = (emote.strength || 1) * pulse;
    switch (emote.name) {
      case 'wave':
        pose.armR.rotation.x = -0.3 + Math.sin(tNorm * Math.PI * 6) * 1.0 * emote.strength;
        pose.armR.rotation.z = -0.35;
        pose.headG.rotation.y = 0.2;
        break;
      case 'kiss':
        pose.armR.rotation.x = -1.05 + Math.sin(tNorm * Math.PI * 4) * 0.22;
        pose.armL.rotation.x = -0.22;
        pose.headG.rotation.y = Math.sin(tNorm * Math.PI * 2) * 0.16;
        pose.core.rotation.x += 0.04;
        break;
      case 'salute':
        pose.armR.rotation.x = -1.28;
        pose.armR.rotation.z = -0.55;
        pose.headG.rotation.y = 0.14;
        break;
      case 'nod':
        pose.headG.rotation.x += Math.abs(Math.sin(tNorm * Math.PI * 4)) * 0.24;
        pose.armL.rotation.x = -0.12;
        pose.armR.rotation.x = 0.12;
        break;
      default:
        pose.core.rotation.z += amp * 0.08;
        pose.armL.rotation.x += amp * 0.24;
        pose.armR.rotation.x -= amp * 0.24;
        break;
    }
    if (emote.time <= 0) pose.emote = null;
  }
}

/** Quake/UT-style third person: bob, hip sway, opposite-phase arms/legs. */
function applyBotProceduralAnimation(bot, dt) {
  applyProceduralPoseToMesh(bot.mesh, dt, bot.animSpeed, bot.onSurface, bot.alive);
}

window.applyProceduralPoseToMesh = applyProceduralPoseToMesh;

function triggerProceduralEmote(mesh, name = '') {
  if (!mesh || !mesh.userData || !mesh.userData.proceduralPose) return null;
  const pose = mesh.userData.proceduralPose;
  const pool = ['wave', 'kiss', 'salute', 'nod', 'taunt'];
  const emoteName = pool.includes(name) ? name : pool[(Math.random() * pool.length) | 0];
  pose.emote = {
    name: emoteName,
    time: 1.2,
    duration: 1.2,
    cycles: emoteName === 'nod' ? 3 : 2,
    strength: emoteName === 'kiss' ? 0.9 : 1,
  };
  return emoteName;
}

window.triggerProceduralEmote = triggerProceduralEmote;

function findClipByRegexList(clips, regexList) {
  if (!Array.isArray(clips) || !clips.length) return null;
  for (const rx of regexList) {
    const c = clips.find(clip => rx.test((clip && clip.name) || ''));
    if (c) return c;
  }
  return null;
}

function playDebugClip(mesh, clip, once = false) {
  const mixer = mesh && mesh.userData && mesh.userData.debugAnimMixer;
  if (!mixer || !clip) return false;
  mixer.stopAllAction();
  const action = mixer.clipAction(clip);
  action.reset();
  action.enabled = true;
  action.clampWhenFinished = !!once;
  action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
  action.play();
  return true;
}

function triggerDebugDisplayAnimation(mesh, requested = 'random') {
  if (!mesh || !mesh.userData) return false;
  const clips = mesh.userData.botClips;
  const hasMixer = !!mesh.userData.debugAnimMixer;
  const req = (requested || 'random').toLowerCase();

  if (hasMixer && Array.isArray(clips) && clips.length) {
    const idleClip = findClipByRegexList(clips, [/idle/i, /stand/i, /breathe/i]) || clips[0];
    const waveClip = findClipByRegexList(clips, [/hello/i, /wave/i]);
    const kissClip = findClipByRegexList(clips, [/blow.?kiss/i, /\bkiss\b/i]);

    const gameplayCandidates = [
      findClipByRegexList(clips, [/run/i, /sprint/i]),
      findClipByRegexList(clips, [/walk/i, /jog/i, /strafe/i, /\bmove\b/i]),
      findClipByRegexList(clips, [/jump/i, /hop/i]),
      findClipByRegexList(clips, [/shoot/i, /fire/i, /attack/i]),
      findClipByRegexList(clips, [/hit/i, /react/i, /pain/i]),
      findClipByRegexList(clips, [/taunt/i, /gesture/i, /celebrate/i]),
      idleClip,
    ].filter(Boolean);

    let chosen = null;
    let once = false;
    if (req === 'wave') {
      chosen = waveClip;
      once = true;
    } else if (req === 'kiss') {
      chosen = kissClip;
      once = true;
    } else {
      chosen = gameplayCandidates[(Math.random() * gameplayCandidates.length) | 0] || idleClip;
      once = !/idle|run|walk|jog|strafe|move/i.test((chosen && chosen.name) || '');
    }

    if (chosen && playDebugClip(mesh, chosen, once)) {
      if (once && idleClip) {
        mesh.userData.debugAnimReturn = {
          timer: Math.max(0.25, Math.min(1.8, (chosen.duration || 1.1) * 0.92)),
          idleClip,
        };
      } else {
        mesh.userData.debugAnimReturn = null;
      }
      return true;
    }
  }

  // Fallback (procedural bots or no suitable clip found).
  return !!triggerProceduralEmote(mesh, req === 'kiss' ? 'kiss' : (req === 'wave' ? 'wave' : 'taunt'));
}

window.triggerDebugDisplayAnimation = triggerDebugDisplayAnimation;

function createBotMesh(idx) {
  if (botModelTemplates.length > 0) {
    const tpl = botModelTemplates[idx % botModelTemplates.length];
    const SU = window.SkeletonUtils;
    const root = SU ? SU.clone(tpl.scene) : tpl.scene.clone(true);
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    fitAndGroundBotRoot(root);

    root.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    let mixer = null;
    if (tpl.clips && tpl.clips.length) {
      mixer = new THREE.AnimationMixer(root);
      const idle = tpl.clips.find(c => /idle/i.test(c.name)) || tpl.clips[0];
      mixer.clipAction(idle).play();
    }
    root.userData.botClips = tpl.clips || [];

    const hitbox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.75, 2.0, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.y = BOT_HEIGHT * 0.47;
    root.add(hitbox);

    return { mesh: root, mixer };
  }

  return { mesh: createProceduralBotMesh(idx), mixer: null };
}

window.createBotMesh = createBotMesh;

function applyTeamVisualToBot(bot, team = null) {
  if (!bot || !bot.mesh) return;
  const tint = team === 'red'
    ? new THREE.Color(0xff6666)
    : (team === 'blue' ? new THREE.Color(0x66aaff) : null);
  bot.mesh.traverse(child => {
    if (!child || !child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) {
      if (!m || !m.color) continue;
      if (!m.userData) m.userData = {};
      if (!m.userData.__teamBase) {
        m.userData.__teamBase = {
          color: m.color.clone(),
          emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0x000000),
          emissiveIntensity: m.emissiveIntensity ?? 0,
        };
      }
      const base = m.userData.__teamBase;
      if (!tint) {
        m.color.copy(base.color);
        if (m.emissive) {
          m.emissive.copy(base.emissive);
          m.emissiveIntensity = base.emissiveIntensity;
        }
      } else {
        m.color.copy(base.color).lerp(tint, 0.55);
        if (m.emissive) {
          m.emissive.copy(base.emissive).lerp(tint, 0.35);
          m.emissiveIntensity = Math.max(base.emissiveIntensity, 0.25);
        }
      }
      m.needsUpdate = true;
    }
  });
}

window.__TA_BOT_APPLY_TEAM_VISUAL = applyTeamVisualToBot;

async function preloadBotModels() {
  botModelTemplates.length = 0;
  if (!BOT_GLB_NAMES.length) return false;

  const Loader = await waitForGLTFLoader();
  if (!Loader) {
    console.warn('GLTFLoader missing — using procedural bots.');
    return false;
  }
  const loader = new Loader();
  return Promise.allSettled(
    BOT_GLB_NAMES.map(
      name => new Promise((resolve, reject) => {
        const url = resolveBotModelUrl(name);
        loader.load(url, resolve, undefined, reject);
      })
    )
  ).then(results => {
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        const gltf = r.value;
        botModelTemplates.push({
          scene: gltf.scene,
          clips: gltf.animations || [],
        });
      } else {
        console.warn('Bot GLB failed:', BOT_GLB_NAMES[i], r.reason);
      }
    }
    if (botModelTemplates.length === 0) console.warn('No GLB bots loaded — procedural meshes.');
    return botModelTemplates.length > 0;
  });
}

// ── Spawn & respawn ───────────────────────────────────────────────────────────

function pickSafeBotSpawn(excludeBot = null) {
  let pts = SPAWN_POINTS[currentMap] || [];
  if (window.__TA_CTF_ACTIVE && excludeBot && excludeBot.team) {
    const filtered = pts.filter(sp => excludeBot.team === 'blue' ? sp[0] <= 0 : sp[0] >= 0);
    if (filtered.length) pts = filtered;
  }
  if (!pts.length) return randomSpawn();
  const playerPos = new THREE.Vector3();
  camera.getWorldPosition(playerPos);
  let best = pts[0];
  let bestScore = -Infinity;
  for (const sp of pts) {
    const p = new THREE.Vector3(sp[0], sp[1], sp[2]);
    let minOther = Infinity;
    for (const b of bots) {
      if (b === excludeBot || !b.alive) continue;
      const d = p.distanceTo(b.mesh.position);
      if (d < minOther) minOther = d;
    }
    const dPlayer = state.alive ? p.distanceTo(playerPos) : 26;
    const score = minOther * 1.2 + dPlayer * 0.7;
    if (score > bestScore) { bestScore = score; best = sp; }
  }
  return best;
}

function spawnBot(index) {
  const sp = pickSafeBotSpawn();
  const { mesh, mixer } = createBotMesh(index);
  mesh.position.set(sp[0], sp[1], sp[2]);
  scene.add(mesh);
  const diff = getDifficultySettings();
  const human = getDifficultyHumanization(null);
  const bot = {
    mesh, mixer, name: BOT_NAMES[index] || `Bot ${index + 1}`, colorIdx: index,
    alive: true, kills: 0, deaths: 0, respawnTimer: 0,
    shootTimer: (1.05 + Math.random() * 1.2) * activeBotPreset.shootDelayMul * diff.shootDelayMul,
    strafeSign: Math.random() < 0.5 ? -1 : 1,
    target: null, retargetTimer: (1.2 + Math.random() * 1.8) * activeBotPreset.retargetMul * diff.retargetMul,
    velY: 0, jumptimer: 1 + Math.random() * 2.5,
    skill:     Math.max(0.05, Math.min(0.98, (BOT_SKILLS[index] ?? 0.5) + diff.skillOffset)),
    health: 100,
    armor: 0,
    shieldBelt: 0,
    ammo: { bullets: 140, cells: 24, rockets: 12 },
    unlocked: { enforcer: true, shock: true, rocket: true },
    activeWeapon: 'enforcer',
    fakePing:  18 + Math.floor(Math.random() * 140),
    sawTargetAt:   -999,              // time of first LOS contact
    prevTargetPos: null,              // target position last frame (aim prediction)
    fakeTimer:     0,                 // when bot switches strafe direction
    onSurface:     false,             // on ground or platform?
    stuckTimer:    0,                 // stuck-detection interval
    lastPos:       new THREE.Vector3(),
    animSpeed:     0,
    repositionTimer: 0,
    missPenaltyTimer: 0,
    engageBias: Math.random() * 2 - 1,
    navRecentEdge: null,
    navTargetNode: -1,
    navFailMem: {},
    personality: null,
    aiState: 'fight',
    stateTimer: 0.45 + Math.random() * 1.05,
    lastSeenTargetAt: -999,
    peekTimer: 0,
    peekExposeTimer: 0,
    peekCooldown: 0.35 + Math.random() * 0.8,
    peekSide: Math.random() < 0.5 ? -1 : 1,
    thinkTimer: 0.06 + Math.random() * 0.16,
    reactionDelay: (0.28 + Math.random() * 0.22) * human.reactionMul,
    aimPhase: Math.random() * Math.PI * 2,
    aimDrift: (0.03 + Math.random() * 0.045) * human.driftMul,
    aimTempo: 0.25 + Math.random() * 1.0,
  };
  ensureBotPersonality(bot, index);
  return bot;
}

function respawnBot(bot) {
  const diff = getDifficultySettings();
  const human = getDifficultyHumanization(bot);
  const sp = pickSafeBotSpawn(bot);
  bot.mesh.position.set(sp[0], sp[1], sp[2]);
  bot.mesh.visible = true; bot.alive = true; bot.velY = 0;
  bot.strafeSign   = Math.random() < 0.5 ? -1 : 1;
  bot.shootTimer   = (0.95 + Math.random() * 1.2) * activeBotPreset.shootDelayMul * diff.shootDelayMul;
  bot.retargetTimer = (0.4 + Math.random() * 1.1) * activeBotPreset.retargetMul * diff.retargetMul;
  bot.sawTargetAt   = -999; bot.prevTargetPos = null; bot.fakeTimer = 0;
  bot.health = 100;
  bot.armor = Math.max(0, bot.armor || 0);
  bot.shieldBelt = 0;
  bot.uDamageTimer = 0;
  bot.tntTimer = 0;
  bot.onSurface = false; bot.stuckTimer = 0; bot.lastPos.copy(bot.mesh.position);
  bot.jumptimer = 1 + Math.random() * 2;
  bot.animSpeed = 0;
  bot.repositionTimer = 0;
  bot.missPenaltyTimer = 0;
  bot.engageBias = Math.random() * 2 - 1;
  bot.navRecentEdge = null;
  bot.navTargetNode = -1;
  bot.navFailMem = {};
  ensureBotPersonality(bot, bot.colorIdx || 0);
  bot.aiState = 'fight';
  bot.stateTimer = 0.45 + Math.random() * 1.05;
  bot.lastSeenTargetAt = -999;
  bot.peekTimer = 0;
  bot.peekExposeTimer = 0;
  bot.peekCooldown = 0.35 + Math.random() * 0.8;
  bot.peekSide = Math.random() < 0.5 ? -1 : 1;
  bot.thinkTimer = 0.04 + Math.random() * 0.14;
  bot.reactionDelay = (0.32 + Math.random() * 0.22 - bot.skill * 0.14) * activeBotPreset.reactionMul * diff.reactionMul * human.reactionMul;
  bot.aimPhase = Math.random() * Math.PI * 2;
  bot.aimDrift = (0.03 + Math.random() * 0.045) * human.driftMul;
  bot.aimTempo = 0.25 + Math.random() * 1.0;
}

// ── Target selection ────────────────────────────────────────────────────────

function countOthersTargetingPlayer(excludeBot) {
  let n = 0;
  for (const b of bots) {
    if (b === excludeBot || !b.alive) continue;
    if (b.target === null) n++;
  }
  return n;
}

function isCtfActiveBots() {
  return !!window.__TA_CTF_ACTIVE;
}

function playerTeamBots() {
  return window.__TA_PLAYER_TEAM || 'blue';
}

function ensureBotPersonality(bot, seed = 0) {
  if (bot.personality) return;
  const idx = Math.abs((seed | 0) + ((bot.colorIdx || 0) * 17)) % BOT_PERSONALITIES.length;
  bot.personality = BOT_PERSONALITIES[idx];
}

function personalityAimScale(bot) {
  switch (bot.personality) {
    case 'duelist': return 0.9;
    case 'cautious': return 1.08;
    case 'rusher': return 1.12;
    case 'flanker': return 1.0;
    case 'aggressive':
    default: return 0.96;
  }
}

function personalityMoveTuning(bot, dist) {
  switch (bot.personality) {
    case 'cautious': return { ffBias: dist > 12 ? 0.12 : -0.22, strafeMul: 1.2 };
    case 'rusher': return { ffBias: 0.28, strafeMul: 0.86 };
    case 'flanker': return { ffBias: 0.04, strafeMul: 1.28 };
    case 'duelist': return { ffBias: 0.08, strafeMul: 1.06 };
    case 'aggressive':
    default: return { ffBias: 0.18, strafeMul: 0.96 };
  }
}

function botHasLineOfSightToTarget(bot, targetPos) {
  if (!bot || !bot.mesh || !targetPos) return false;
  const origin = bot.mesh.position.clone().add(new THREE.Vector3(0, BOT_HEIGHT * 0.72, 0));
  const losDir = targetPos.clone().sub(origin);
  const losLen = losDir.length();
  if (!Number.isFinite(losLen) || losLen <= 0.001) return true;
  losDir.multiplyScalar(1 / losLen);
  const losRay = new THREE.Raycaster(origin, losDir, 0.1, Math.min(220, losLen));
  const losHits = losRay.intersectObjects(arenaObjects.filter(o => o && o.hw > 2).map(o => o.mesh), false);
  return !(losHits.length > 0 && losHits[0].distance < losLen - 0.5);
}

function updateBotCombatState(bot, dist, hasLOS) {
  const hp = Math.max(0, Math.min(1, (bot.health || 100) / 100));
  const human = getDifficultyHumanization(bot);
  const now = performance.now() / 1000;
  if (hasLOS) bot.lastSeenTargetAt = now;
  const seenAgo = now - (bot.lastSeenTargetAt || -999);
  bot.stateTimer = Math.max(0, (bot.stateTimer || 0) - 0.016);

  if (bot.stateTimer <= 0) {
    let nextState = 'fight';
    if (!hasLOS && seenAgo > 1.2) nextState = 'chase';
    if (hasLOS && hp < (0.3 * human.retreatBias) && dist < 16) nextState = 'retreat';
    if (bot.personality === 'flanker' && dist > 9 && dist < 22 && Math.random() < 0.45) nextState = 'ambush';
    if (bot.personality === 'cautious' && hp < (0.45 * human.retreatBias) && dist < 14) nextState = 'retreat';
    if (bot.personality === 'rusher' && hasLOS && dist > (7 / Math.max(0.8, human.chaseBias))) nextState = 'chase';
    bot.aiState = nextState;
    bot.stateTimer = 0.55 + Math.random() * 1.1;
  }
}

function updateBotPeekBehavior(bot, dist, hasLOS) {
  const human = getDifficultyHumanization(bot);
  bot.peekTimer = Math.max(0, (bot.peekTimer || 0) - 0.016);
  bot.peekExposeTimer = Math.max(0, (bot.peekExposeTimer || 0) - 0.016);
  bot.peekCooldown = Math.max(0, (bot.peekCooldown || 0) - 0.016);

  const canPeekRange = dist > 7 && dist < 24;
  const wantsPeek = !hasLOS && canPeekRange && bot.peekCooldown <= 0 && bot.aiState !== 'chase';
  if (wantsPeek && bot.peekTimer <= 0 && bot.peekExposeTimer <= 0) {
    const pBias = bot.personality === 'cautious' ? 0.48 : (bot.personality === 'duelist' ? 0.44 : 0.36);
    if (Math.random() < (pBias * human.peekChanceMul)) {
      bot.peekSide = Math.random() < 0.5 ? -1 : 1;
      bot.peekTimer = 0.18 + Math.random() * 0.26; // hold / shoulder-ready
      bot.peekExposeTimer = 0.12 + Math.random() * 0.22; // short expose
      bot.peekCooldown = 0.9 + Math.random() * 1.4;
    }
  }
}

function pickTarget(bot) {
  bot.sawTargetAt = -999;
  const candidates = [];
  if (state.alive) {
    const pp = new THREE.Vector3(); camera.getWorldPosition(pp);
    if (!isCtfActiveBots() || bot.team !== playerTeamBots()) {
      candidates.push({ type: 'player', dist: pp.distanceTo(bot.mesh.position) });
    }
  }
  for (const o of bots) {
    if (o === bot || !o.alive) continue;
    if (isCtfActiveBots() && bot.team && o.team && bot.team === o.team) continue;
    candidates.push({ type: 'bot', ref: o, dist: o.mesh.position.distanceTo(bot.mesh.position) });
  }
  if (candidates.length === 0) { bot.target = null; return; }
  candidates.sort((a, b) => a.dist - b.dist);
  const othersOnPlayer = countOthersTargetingPlayer(bot);
  const weights = candidates.map((c, i) => {
    let w = Math.max(1, candidates.length - i) * (0.88 + Math.random() * 0.26);
    if (c.type === 'player') {
      w *= 0.45;
      if (othersOnPlayer >= 4) w *= 0.08;
      else if (othersOnPlayer >= 3) w *= 0.18;
      else if (othersOnPlayer >= 2) w *= 0.38;
      else if (othersOnPlayer >= 1) w *= 0.62;
    }
    if (bot.personality === 'rusher' && c.dist < 12) w *= 1.3;
    if (bot.personality === 'cautious' && c.dist < 7) w *= 0.72;
    if (bot.personality === 'flanker' && c.dist > 8 && c.dist < 24) w *= 1.16;
    return w;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) { bot.target = candidates[i].type === 'player' ? null : candidates[i].ref; return; }
  }
  bot.target = candidates[0].type === 'player' ? null : candidates[0].ref;
}

// ── Shooting ──────────────────────────────────────────────────────────────────

function botShoot(bot) {
  if (!roundActive) return;
  const classic = isClassicRulesetActive();
  let fireRange = INSTAGIB.range;
  let dmg = 9999;
  let beamColor = INSTAGIB.beamColor;
  let spreadMul = 1;
  if (classic) {
    const distToTarget = bot.target === null
      ? bot.mesh.position.distanceTo((() => { const p = new THREE.Vector3(); camera.getWorldPosition(p); return p; })())
      : bot.mesh.position.distanceTo(bot.target.mesh.position);
    let w = 'enforcer';
    if (distToTarget > 24 && (bot.ammo.cells || 0) > 0) w = 'shock';
    if (distToTarget > 9 && distToTarget < 26 && (bot.ammo.rockets || 0) > 0 && Math.random() < 0.55) w = 'rocket';
    bot.activeWeapon = w;
    if (w === 'enforcer') { fireRange = 230; dmg = 18; beamColor = 0x8ee8ff; spreadMul = 0.78; }
    else if (w === 'shock') { fireRange = 360; dmg = 38; beamColor = 0x77b0ff; spreadMul = 0.58; bot.ammo.cells = Math.max(0, (bot.ammo.cells || 0) - 1); }
    else { fireRange = 300; dmg = 62; beamColor = 0xffaa66; spreadMul = 0.86; bot.ammo.rockets = Math.max(0, (bot.ammo.rockets || 0) - 1); }
    if ((bot.uDamageTimer || 0) > 0) dmg = Math.round(dmg * 1.5);
  } else if (isInstagibPlusRulesetActive() && (bot.uDamageTimer || 0) > 0) {
    beamColor = 0xffcc66;
  } else if (isInstagibPlusRulesetActive() && (bot.tntTimer || 0) > 0) {
    beamColor = 0xff7744;
  }
  const diff = getDifficultySettings();
  const human = getDifficultyHumanization(bot);
  let origin;
  if (bot.mesh.userData.weaponMuzzle) {
    bot.mesh.userData.weaponMuzzle.getWorldPosition(tmpBotMuzzle);
    origin = tmpBotMuzzle;
  } else {
    origin = bot.mesh.position.clone().add(new THREE.Vector3(0, BOT_HEIGHT * 0.8, 0));
  }
  const targetIsPlayer = (bot.target === null);
  if (isCtfActiveBots() && targetIsPlayer && bot.team === playerTeamBots()) return;
  if (targetIsPlayer) {
    if (!state.alive || state.invincible > 0) return;
  } else {
    if (!bot.target.alive) return;
  }

  let targetPos = targetIsPlayer
    ? (() => { const v = new THREE.Vector3(); camera.getWorldPosition(v); return v; })()
    : bot.target.mesh.position.clone().add(new THREE.Vector3(0, BOT_HEIGHT * 0.5, 0));

  // LOS: obstacle between bot and target → reset reaction time
  const losDir = targetPos.clone().sub(origin).normalize();
  const losRay = new THREE.Raycaster(origin, losDir, 0.1, 200);
  const losHits = losRay.intersectObjects(arenaObjects.filter(o => o.hw > 2).map(o => o.mesh), false);
  if (losHits.length > 0 && losHits[0].distance < targetPos.distanceTo(origin) - 0.5) {
    bot.sawTargetAt = -999; return;
  }

  // Reaction time: bot acquires target before firing
  const nowSec = performance.now() / 1000;
  if (bot.sawTargetAt < 0) bot.sawTargetAt = nowSec;
  if (!Number.isFinite(bot.reactionDelay) || bot.reactionDelay <= 0) {
    bot.reactionDelay = (0.42 - bot.skill * 0.22) * activeBotPreset.reactionMul * diff.reactionMul * human.reactionMul;
  }
  if (nowSec - bot.sawTargetAt < bot.reactionDelay) return;

  // Aim prediction from last-frame motion
  if (bot.prevTargetPos) {
    const vel = targetPos.clone().sub(bot.prevTargetPos);
    const predMul = (0.04 + bot.skill * 0.09) * (bot.personality === 'duelist' ? 1.12 : 1.0) * human.predictionMul;
    targetPos.addScaledVector(vel, predMul * 60);
  }

  const pp3 = new THREE.Vector3(); camera.getWorldPosition(pp3);
  playWeaponFireSpatial(origin.distanceTo(pp3));

  // Distance-dependent spread
  const shotDist   = origin.distanceTo(targetPos);
  // ═══════════════════════════════════════════════════════════════════
  // HUMAN AIM SYSTEM - as used in Call of Duty / Battlefield
  // ═══════════════════════════════════════════════════════════════════
  
  // Initialize bot aim state if missing
  if (!bot.aimState) {
    bot.aimState = {
      lastTargetX: 0,
      lastTargetY: 0,
      errorX: 0,
      errorY: 0,
      errorVelocityX: 0,
      errorVelocityY: 0,
      acquiredAt: 0,
      lastUpdate: 0,
    };
  }
  
  const now = performance.now();
  const dt = Math.min(0.05, (now - bot.aimState.lastUpdate) / 1000);
  bot.aimState.lastUpdate = now;
  
  // How long have we been tracking this target?
  const trackingTime = bot.sawTargetAt > 0 ? (now - bot.sawTargetAt) / 1000 : 999;
  
  // Base spread values
  const baseSpread = (0.32 - bot.skill * 0.18) * activeBotPreset.spreadMul * diff.spreadMul * spreadMul * personalityAimScale(bot) * human.aimSpreadMul;
  const spread = baseSpread * Math.min(1.6, 0.5 + shotDist / 55);
  
  // Get ideal direction
  const dir = targetPos.clone().sub(origin).normalize();
  
  // ── AIM SETTLING CURVE ───────────────────────────────────────────
  // Bots are WORSE when they first acquire a target, get better over time
  // Exactly like human players: 0.8s to fully settle aim
  const settleProgress = Math.min(1.0, trackingTime / 0.8);
  const settleMultiplier = 1.7 - (settleProgress * 0.7);
  
  // ── TRACKING OVERCORRECTION ─────────────────────────────────────
  // Humans always overshoot then correct back
  const targetVelocityX = dir.x - bot.aimState.lastTargetX;
  const targetVelocityY = dir.y - bot.aimState.lastTargetY;
  
  // Magnitude of overshoot: worse for fast moving targets
  const overshootAmount = 0.12 + (Math.abs(targetVelocityX) + Math.abs(targetVelocityY)) * 1.2;
  
  // Apply spring physics to aim error (natural feeling correction)
  bot.aimState.errorVelocityX += ((targetVelocityX * overshootAmount) - bot.aimState.errorX * 8 - bot.aimState.errorVelocityX * 3.5) * dt;
  bot.aimState.errorVelocityY += ((targetVelocityY * overshootAmount) - bot.aimState.errorY * 8 - bot.aimState.errorVelocityY * 3.5) * dt;
  bot.aimState.errorX += bot.aimState.errorVelocityX * dt;
  bot.aimState.errorY += bot.aimState.errorVelocityY * dt;
  
  bot.aimState.lastTargetX = dir.x;
  bot.aimState.lastTargetY = dir.y;
  
  // ── MICRO JITTER ─────────────────────────────────────────────────
  // Tiny constant hand tremor that all humans have
  const phase = now * 0.001 + (bot.aimPhase || 0);
  const drift = (bot.aimDrift || 0.06) * human.driftMul;
  
  const tremorX = Math.sin(phase * 7.2) * drift * 0.15;
  const tremorY = Math.cos(phase * 5.8) * drift * 0.1;
  
  // ── RANDOM MISS CHANCE ───────────────────────────────────────────
  // 8% chance to completely miss the target, just like real players
  const randomMissRoll = Math.random();
  let missBonus = 0;
  if (randomMissRoll < 0.08) {
    missBonus = spread * (0.5 + Math.random() * 1.5);
  }
  
  // ── COMBINE EVERYTHING ───────────────────────────────────────────
  const finalSpread = spread * settleMultiplier;
  
  dir.x += bot.aimState.errorX * 0.35 + tremorX + (Math.random() - 0.5) * finalSpread + missBonus * (Math.random() > 0.5 ? 1 : -1);
  dir.y += bot.aimState.errorY * 0.25 + tremorY + (Math.random() - 0.5) * finalSpread * 0.6;
  
  dir.normalize();

  const end = origin.clone().addScaledVector(dir, fireRange);
  const projectileClassic = classic && (bot.activeWeapon === 'enforcer' || bot.activeWeapon === 'rocket');
  if (projectileClassic && typeof window.__TA_SPAWN_CLASSIC_PROJECTILE === 'function') {
    window.__TA_SPAWN_CLASSIC_PROJECTILE(
      bot.activeWeapon === 'rocket' ? 'rocket' : 'bullet',
      origin.clone(),
      dir.clone(),
      bot,
      dmg
    );
  } else {
    spawnBeam(origin, end, beamColor, INSTAGIB.beamLife);
  }
  // UT-like Instagib rhythm: fire, then quickly reposition for next peek.
  bot.repositionTimer = (0.34 + Math.random() * 0.28) * activeBotPreset.repositionMul * diff.repositionMul;
  if (Math.random() < 0.9) bot.strafeSign *= -1;

  let hitSomething = projectileClassic;
  if (state.alive && state.invincible <= 0) {
    const pp  = new THREE.Vector3(); camera.getWorldPosition(pp);
    const toP = pp.clone().sub(origin);
    const t   = Math.max(0, Math.min(toP.length(), toP.dot(dir)));
    if (t <= fireRange && origin.clone().addScaledVector(dir, t).distanceTo(pp) < 0.7) {
      if (classic && typeof window.__TA_APPLY_DAMAGE_PLAYER === 'function') window.__TA_APPLY_DAMAGE_PLAYER(dmg, bot);
      else instagibPlayer(bot);
      hitSomething = true;
    }
  }
  for (const other of bots) {
    if (other === bot || !other.alive) continue;
    if (isCtfActiveBots() && bot.team && other.team && bot.team === other.team) continue;
    const op  = other.mesh.position.clone().add(new THREE.Vector3(0, BOT_HEIGHT * 0.5, 0));
    const toO = op.clone().sub(origin);
    const tO  = Math.max(0, Math.min(toO.length(), toO.dot(dir)));
    if (tO <= fireRange && origin.clone().addScaledVector(dir, tO).distanceTo(op) < 0.8) {
      if (classic && typeof window.__TA_APPLY_DAMAGE_BOT === 'function') window.__TA_APPLY_DAMAGE_BOT(other, dmg, bot);
      else if (typeof window.__TA_TRY_INSTAGIB_SHIELD_BOT === 'function' && window.__TA_TRY_INSTAGIB_SHIELD_BOT(other)) {}
      else killBot(other, bot);
      hitSomething = true;
    }
  }
  if (!hitSomething) {
    // Missed shot: briefly avoid instant repeek spam.
    bot.missPenaltyTimer = (0.22 + Math.random() * 0.2) * activeBotPreset.repositionMul * diff.repositionMul;
  }
}

// ── Update-loop ───────────────────────────────────────────────────────────────

const tmpDir   = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpMove  = new THREE.Vector3();
const tmpNavBlend = new THREE.Vector3();

function getTargetPos(bot) {
  if (bot.target === null) { const p = new THREE.Vector3(); camera.getWorldPosition(p); return p; }
  return bot.target.mesh.position.clone().add(new THREE.Vector3(0, BOT_HEIGHT * 0.5, 0));
}

// Highest walkable top at (x,z) at or below feet (ignores higher platforms / “ceilings” above you)
function morpheusSupportTopAtFeet(x, z, feetY) {
  const margin = 0.48;
  let best = -1e9;
  for (const o of arenaObjects) {
    const c = o.mesh.position;
    const top = c.y + o.hh;
    if (top > feetY + 0.42) continue;
    if (Math.abs(x - c.x) > o.hw + margin) continue;
    if (Math.abs(z - c.z) > o.hd + margin) continue;
    if (top > best) best = top;
  }
  return best;
}

function morpheusFeetOnStableGround(feetY, x, z) {
  const t = morpheusSupportTopAtFeet(x, z, feetY);
  return t > -500 && t >= feetY - 1.05 && t <= feetY + 0.45;
}

// Avoid walking off platforms: scale move if next foot position has no solid ground
function clampMorpheusHorizontalMove(bp, move) {
  const fy = bp.y;
  if (!morpheusFeetOnStableGround(fy, bp.x, bp.z)) return;
  const nx = bp.x + move.x;
  const nz = bp.z + move.z;
  const nextTop = morpheusSupportTopAtFeet(nx, nz, fy);
  if (nextTop >= fy - 0.85) return;
  for (let s = 0.5; s >= 0.08; s -= 0.07) {
    const tx = bp.x + move.x * s;
    const tz = bp.z + move.z * s;
    if (morpheusSupportTopAtFeet(tx, tz, fy) >= fy - 0.85) {
      move.x *= s;
      move.z *= s;
      return;
    }
  }
  move.x = 0;
  move.z = 0;
}

// Generic void safety: avoid stepping into large drops on any map.
function supportTopAtFeetGeneric(x, z, centerY) {
  const feetY = centerY - BOT_HEIGHT * 0.5;
  const margin = 0.5;
  let best = -1e9;
  for (const o of arenaObjects) {
    const c = o.mesh.position;
    const top = c.y + o.hh;
    if (top > feetY + 0.45) continue;
    if (Math.abs(x - c.x) > o.hw + margin) continue;
    if (Math.abs(z - c.z) > o.hd + margin) continue;
    if (top > best) best = top;
  }
  // Fallback for maps with a true ground plane.
  if (best < -500 && currentMap !== 2) best = BOT_HEIGHT * 0.5;
  return best;
}

function hasSupportAt(x, z, centerY, maxDrop = 1.05) {
  const feetY = centerY - BOT_HEIGHT * 0.5;
  const t = supportTopAtFeetGeneric(x, z, centerY);
  return t > -500 && t >= feetY - maxDrop;
}

function clampVoidHorizontalMove(bp, move) {
  const cy = bp.y;
  const nx = bp.x + move.x;
  const nz = bp.z + move.z;
  if (hasSupportAt(nx, nz, cy, currentMap === 2 ? 0.75 : 1.0)) return false;
  // Scale down to last safe fraction.
  for (let s = 0.75; s >= 0.08; s -= 0.08) {
    const tx = bp.x + move.x * s;
    const tz = bp.z + move.z * s;
    if (hasSupportAt(tx, tz, cy, currentMap === 2 ? 0.75 : 1.0)) {
      move.x *= s;
      move.z *= s;
      return false;
    }
  }
  move.x = 0;
  move.z = 0;
  return true;
}

function updateBots(dt) {
  const diff = getDifficultySettings();
  ensureNavGraphLoaded();
  if (navLearnState.training && navLearnState.bootstrapActive) {
    const elapsed = performance.now() - (navLearnState.bootstrapStartMs || 0);
    if (elapsed >= navLearnState.bootstrapDurationMs) {
      navLearnState.bootstrapActive = false;
      navLearnState.minLearnMove = navLearnState.stableConfig.minLearnMove;
      navLearnState.nodeRadiusXZ = navLearnState.stableConfig.nodeRadiusXZ;
      navLearnState.maxOutEdgesPerNode = navLearnState.stableConfig.maxOutEdgesPerNode;
      navLearnState.forceTurnAngleDeg = navLearnState.stableConfig.forceTurnAngleDeg;
      simplifyNavGraph();
      saveNavGraph();
    }
  }
  for (const bot of bots) {
    if (bot.alive && bot.mixer) bot.mixer.update(dt);
  }
  for (const bot of bots) {
    if (!bot.alive) {
      bot.respawnTimer -= dt;
      if (bot.respawnTimer <= 0) respawnBot(bot);
      continue;
    }
    if (isClassicRulesetActive() || isInstagibPlusRulesetActive()) {
      bot.uDamageTimer = Math.max(0, (bot.uDamageTimer || 0) - dt);
    }
    if (isInstagibPlusRulesetActive()) {
      bot.tntTimer = Math.max(0, (bot.tntTimer || 0) - dt);
    }
    decayBotFailMemory(bot, dt);

    // Human-like cadence: not every bot reevaluates every frame.
    bot.thinkTimer = Math.max(0, (bot.thinkTimer || 0) - dt);
    if (bot.thinkTimer <= 0) {
      bot.thinkTimer = 0.07 + Math.random() * 0.12;
      bot.retargetTimer -= 0.12;
    }

    // Target management
    if (bot.retargetTimer <= 0
        || (bot.target !== null && !bot.target.alive)
        || (bot.target === null && !state.alive)) {
      pickTarget(bot); bot.retargetTimer = (1.2 + Math.random() * 1.8) * activeBotPreset.retargetMul * diff.retargetMul;
      const human = getDifficultyHumanization(bot);
      bot.reactionDelay = (0.36 + Math.random() * 0.2 - bot.skill * 0.16) * activeBotPreset.reactionMul * diff.reactionMul * human.reactionMul;
    }

    const itemPos = ((isClassicRulesetActive() || isInstagibPlusRulesetActive()) && typeof window.__TA_CLASSIC_BOT_ITEM_TARGET === 'function')
      ? window.__TA_CLASSIC_BOT_ITEM_TARGET(bot)
      : null;
    const targetPos = itemPos || getTargetPos(bot);
    const bp        = bot.mesh.position;
    const toTarget  = targetPos.clone().sub(bp);
    const dist      = toTarget.length();
    const hasLOS    = botHasLineOfSightToTarget(bot, targetPos);
    updateBotCombatState(bot, dist, hasLOS);
    updateBotPeekBehavior(bot, dist, hasLOS);
    toTarget.y = 0; toTarget.normalize();
    let navDir = navDesiredDirection(bot, targetPos);
    // Morpheus: blend learned nav with direct target so movement stays grounded in geometry + clamps.
    if (navDir && currentMap === 2) {
      const w = 0.52;
      tmpNavBlend.copy(navDir).multiplyScalar(w).addScaledVector(toTarget, 1 - w);
      if (tmpNavBlend.lengthSq() > 0.0001) tmpNavBlend.normalize();
      navDir = tmpNavBlend;
    }
    let navCrowd = 0;
    if (navDir && Number.isFinite(bot.navTargetNode) && bot.navTargetNode >= 0) {
      for (const ob of bots) {
        if (!ob || ob === bot || !ob.alive) continue;
        if (ob.navTargetNode === bot.navTargetNode) navCrowd++;
      }
    }
    tmpRight.set(-toTarget.z, 0, toTarget.x).multiplyScalar(bot.strafeSign);

    // Local pressure shaping: avoid bot clumps and force multi-angle threats.
    let alliesNear = 0;
    const sep = new THREE.Vector3();
    for (const other of bots) {
      if (other === bot || !other.alive) continue;
      const dx = bp.x - other.mesh.position.x;
      const dz = bp.z - other.mesh.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 196) alliesNear++;
      if (d2 > 0.0001 && d2 < 110) {
        const inv = 1 / Math.sqrt(d2);
        sep.x += dx * inv;
        sep.z += dz * inv;
      }
    }

    // Faking: switch strafe direction at close range
    bot.fakeTimer -= dt;
    if (bot.fakeTimer <= 0 && dist < 18) {
      const classic = isClassicRulesetActive();
      bot.fakeTimer = classic ? (0.85 + Math.random() * 1.25) : (0.42 + Math.random() * 0.85);
      if (Math.random() < (classic ? 0.18 : 0.38)) bot.strafeSign *= -1;
    }

    bot.repositionTimer = Math.max(0, (bot.repositionTimer || 0) - dt);
    bot.missPenaltyTimer = Math.max(0, (bot.missPenaltyTimer || 0) - dt);
    let ff = bot.repositionTimer > 0 ? -0.25 : (dist > 16 ? 1 : (dist < 5.5 ? -0.68 : 0));
    let strafeAmt = currentMap === 2 ? 0.32 : (bot.repositionTimer > 0 ? 1.05 : 0.7);
    const classicMove = isClassicRulesetActive();
    if (classicMove) {
      // Classic DM: less orbiting, more direct pressure.
      ff = bot.repositionTimer > 0 ? 0.15 : (dist > 14 ? 1 : (dist < 4.8 ? -0.35 : 0.25));
      strafeAmt *= (dist < 8 ? 0.22 : 0.16);
    }
    const hasNav = !!navDir;
    if (hasNav) {
      // Nav-follow mode: keep forward intent strong, reduce combat strafe noise.
      ff = bot.repositionTimer > 0 ? 0.62 : (currentMap === 2 ? 1.04 : 0.9);
      strafeAmt *= (dist < 9 ? 0.3 : 0.2);
      if (navCrowd >= 1) {
        // Encourage side dispersion around shared nodes.
        strafeAmt += 0.18 + Math.min(0.35, navCrowd * 0.12);
      }
    }
    if (alliesNear >= 2) {
      ff *= 0.82;
      strafeAmt += 0.2 + Math.min(0.22, (alliesNear - 2) * 0.08);
    }
    if (bot.aiState === 'retreat') {
      ff = Math.min(ff, -0.55);
      strafeAmt += 0.18;
    } else if (bot.aiState === 'chase') {
      ff = Math.max(ff, 0.92);
      strafeAmt *= 0.82;
    } else if (bot.aiState === 'ambush') {
      ff *= 0.42;
      strafeAmt *= 1.25;
    }
    if (bot.peekTimer > 0) {
      // Hold briefly behind cover before shoulder peeking.
      ff = Math.min(ff, 0.12);
      strafeAmt = (bot.peekSide || 1) * (0.12 + Math.abs(strafeAmt) * 0.25);
    } else if (bot.peekExposeTimer > 0) {
      // Short lateral expose; low forward commitment for a human-like jiggle peek.
      ff = Math.min(ff, 0.3);
      strafeAmt = (bot.peekSide || 1) * (0.55 + Math.abs(strafeAmt) * 0.6);
    }
    const persona = personalityMoveTuning(bot, dist);
    ff += persona.ffBias;
    strafeAmt *= persona.strafeMul;
    strafeAmt += bot.engageBias * 0.14;
    tmpDir.copy(navDir || toTarget).multiplyScalar(ff).addScaledVector(tmpRight, strafeAmt);
    if (sep.lengthSq() > 0.001) {
      sep.normalize();
      const center = flatArenaCenterWeight(bp.x, bp.z);
      const sepScale = (hasNav ? (0.28 + Math.min(0.2, navCrowd * 0.1)) : 0.34) * (1 - center * 0.45);
      tmpDir.addScaledVector(sep, sepScale);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTEGRATE NEW AI SYSTEMS: High-Ground, Cover, Dynamic Personality
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Update dynamic personality state
    updateBotDynamicState(bot, null);
    const dynamicState = getBotDynamicState(bot);
    
    // High-ground evaluation
    const hgAttractiveness = getHighGroundAttractiveness(bot, bp, targetPos, targetPos.y);
    const hgDirection = hgAttractiveness > 0.3 ? getHighGroundDirection(bot, bp, targetPos) : null;
    
    // Cover evaluation
    const coverMovement = getCoverMovement(bot, bp, targetPos, hasLOS);
    
    // Integrate systems into movement direction
    let moveIntent = tmpDir.clone();
    let intentWeight = 1;
    
    // Apply cover-based movement
    if (coverMovement && coverMovement.action !== 'hold') {
      if (coverMovement.action === 'move_to_cover') {
        // Blend toward cover
        const coverWeight = coverMovement.strength * 0.6;
        moveIntent.addScaledVector(coverMovement.direction, coverWeight);
        intentWeight += coverWeight;
      } else if (coverMovement.action === 'peek') {
        // Brief peek - reduce forward, increase lateral
        ff *= 0.3;
        strafeAmt *= 1.8;
      }
    }
    
    // Apply high-ground preference
    if (hgDirection && hgAttractiveness > 0.4) {
      const hgWeight = hgAttractiveness * (dynamicState ? dynamicState.highGroundDesire : 0.6);
      moveIntent.addScaledVector(hgDirection.direction, hgWeight);
      intentWeight += hgWeight;
      
      // Encourage jumping if high ground requires it
      if (hgDirection.targetHeight > bp.y + 2 && bot.onSurface && heightDiff > 1) {
        bot.jumptimer = Math.min(bot.jumptimer, 0.1); // trigger jump soon
      }
    }
    
    // Normalize combined intent
    if (intentWeight > 1) {
      moveIntent.multiplyScalar(1 / intentWeight);
    }
    if (moveIntent.lengthSq() > 0.0001) {
      moveIntent.normalize();
      tmpDir.copy(moveIntent);
    }
    
    // Apply dynamic state modifiers
    if (dynamicState) {
      // Modify aggression based on state
      if (dynamicState.aggression > 1.2 && hasLOS && dist < 20) {
        ff = Math.max(ff, 0.85); // push harder when dominating/confident
      } else if (dynamicState.aggression < 0.7) {
        ff = Math.min(ff, -0.3); // retreat more when desperate/hunted
      }
      
      // Nemesis focus - if nemesis is target, be more aggressive
      const nemesis = getNemesisTarget(bot);
      if (nemesis && (bot.target === nemesis || (bot.target === null && nemesis === null))) {
        ff *= PERSONALITY_SYSTEM.nemesis.nemesisRevengeAggression;
        strafeAmt *= 1.15;
      }
    }
    
    // Update dynamic state with combat info
    if (hasLOS) {
      // Track if we're applying pressure
      if (dist < 15) {
        // "damage taken" simulation for state awareness
        // (in real implementation, this would come from actual damage events)
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    for (const o of arenaObjects) {
      const dx = bp.x - o.mesh.position.x, dz = bp.z - o.mesh.position.z;
      const ox = o.hw + 2.5 - Math.abs(dx);
      const oz = o.hd + 2.5 - Math.abs(dz);
      if (ox > 0 && oz > 0 && Math.abs(bp.y - o.mesh.position.y) < o.hh + 2) {
        const center = flatArenaCenterWeight(bp.x, bp.z);
        const s = (Math.min(ox, oz) / 2.5) * (1 - center * 0.5);
        if (ox < oz) tmpDir.x += Math.sign(dx) * s;
        else         tmpDir.z += Math.sign(dz) * s;
      }
    }
    if (currentMap === 2 && morpheusFeetOnStableGround(bp.y, bp.x, bp.z)) {
      const d = Math.hypot(bp.x, bp.z);
      if (d > 9) {
        const pull = Math.min(0.5, (d - 9) / 35);
        tmpDir.addScaledVector(new THREE.Vector3(-bp.x / d, 0, -bp.z / d), pull * 0.4);
      }
    }
    // Generic map edge repulsion: pull off outer shell to prevent wall hugging.
    if (currentMap !== 2 && MAP_BOUNDS && MAP_BOUNDS[currentMap]) {
      const bx = MAP_BOUNDS[currentMap][0], bz = MAP_BOUNDS[currentMap][1];
      const edge01 = Math.max(Math.abs(bp.x) / bx, Math.abs(bp.z) / bz);
      
      // Start pulling inwards at 45% from center. This is the fix.
      // The outer 40% of the map is basically unusable because of maze walls.
      const threshold = 0.45;
      const hardWallThreshold = 0.72;
      
      if (edge01 > threshold) {
        const h = Math.hypot(bp.x, bp.z) || 1;
        const pullFactor = 9.0;
        const pullStr = 1.6;
        const pull = Math.min(2.4, (edge01 - threshold) * pullFactor);
        tmpDir.addScaledVector(new THREE.Vector3(-bp.x / h, 0, -bp.z / h), pull * pullStr);
      }
      
      // Absolute hard limit at 72%. They will never even get close to the outer walls.
      if (edge01 > hardWallThreshold) {
        const h = Math.hypot(bp.x, bp.z) || 1;
        tmpDir.set(-bp.x / h, 0, -bp.z / h).normalize();
      }
    }
    tmpDir.y = 0;
    if (tmpDir.lengthSq() > 0) tmpDir.normalize();
    let speedMul = 1;
    if (currentMap === 2) {
      if (bp.y > 6) speedMul = 0.68;
      else if (bp.y > 4) speedMul = 0.78;
      else if (bp.y > 2.2) speedMul = 0.88;
    }
    tmpMove.copy(tmpDir).multiplyScalar(BOT_SPEED * activeBotPreset.speedMul * diff.speedMul * dt * speedMul);
    if (currentMap === 2) clampMorpheusHorizontalMove(bp, tmpMove);
    const blockedByVoid = clampVoidHorizontalMove(bp, tmpMove);
    if (blockedByVoid) {
      // Penalize current route edge and force quick repath away from danger.
      if (bot.navRecentEdge && Number.isFinite(bot.navRecentEdge.a) && Number.isFinite(bot.navRecentEdge.b)) {
        const e = edgeBetween(bot.navRecentEdge.a, bot.navRecentEdge.b);
        if (e) e.fail = Math.min(20, (e.fail || 0) + 1.1);
      }
      bot.navRepathTimer = 0;
      bot.strafeSign *= -1;
      if (bot.navRecentEdge && Number.isFinite(bot.navRecentEdge.a) && Number.isFinite(bot.navRecentEdge.b)) {
        if (!bot.navFailMem) bot.navFailMem = {};
        const key = `${bot.navRecentEdge.a}>${bot.navRecentEdge.b}`;
        const cur = Number(bot.navFailMem[key]) || 0;
        bot.navFailMem[key] = Math.min(10, cur + 1.2);
      }
    }

    bot.animSpeed = Math.hypot(tmpMove.x, tmpMove.z) / Math.max(dt, 1e-4);

    bot.velY += GRAVITY * dt;
    tmpMove.y = bot.velY * dt;
    bp.add(tmpMove);

    // Landing detection
    const GROUND_STICK_EPS = 0.06;
    bot.onSurface = false;
    if (currentMap !== 2 && bp.y <= BOT_HEIGHT / 2) {
      bp.y = BOT_HEIGHT / 2;
      if (bot.velY < 0) { bot.velY = 0; bot.onSurface = true; }
    }
    const platformLanded = resolveBoxCollision(bp, 0.5, BOT_HEIGHT);
    if (platformLanded && bot.velY <= 0) { bot.velY = 0; bot.onSurface = true; }
    // Ground-stick snap: prevents tiny post-jump hover on floor/platform seams.
    if (bot.onSurface) {
      bp.y = Math.max(BOT_HEIGHT / 2, bp.y - GROUND_STICK_EPS);
      const restLanded = resolveBoxCollision(bp, 0.5, BOT_HEIGHT);
      if (restLanded && bot.velY <= 0) bot.velY = 0;
    }

    // Morpheus: fall into void = death
    if (currentMap === 2 && bp.y < -12 && bot.alive) {
      markNavFallHazard(bot);
      killBot(bot, null);
    }

    bp.x = Math.max(-MAP_BOUNDS[currentMap][0], Math.min(MAP_BOUNDS[currentMap][0], bp.x));
    bp.z = Math.max(-MAP_BOUNDS[currentMap][1], Math.min(MAP_BOUNDS[currentMap][1], bp.z));

    bot.mesh.lookAt(targetPos.x, bp.y, targetPos.z);
    if ((isClassicRulesetActive() || isInstagibPlusRulesetActive()) && typeof window.__TA_CLASSIC_BOT_TRY_PICKUP === 'function') {
      window.__TA_CLASSIC_BOT_TRY_PICKUP(bot);
    }
    applyBotProceduralAnimation(bot, dt);
    if (!hasNav && Math.random() < 0.005) bot.strafeSign *= -1;

    // Stuck detection: on Morpheus don’t jump (would fall off platforms)
    bot.stuckTimer -= dt;
    if (bot.stuckTimer <= 0) {
      const moved = Math.hypot(bp.x - bot.lastPos.x, bp.z - bot.lastPos.z);
      if (moved < 0.4 && dist > 3 && bot.onSurface) {
        const stuckSeverity = Math.max(0.45, Math.min(2.1, (0.4 - moved) * 4 + (dist > 10 ? 0.45 : 0)));
        markNavStuckHazard(bot, stuckSeverity);
        bot.navRepathTimer = 0;
        if (currentMap !== 2) {
          if (!isClassicRulesetActive() || dist > 11) {
            bot.velY = JUMP_SPEED * 0.7; bot.onSurface = false;
          } else {
            bot.strafeSign *= -1;
          }
        } else {
          bot.strafeSign *= -1;
        }
      }
      bot.lastPos.copy(bp); bot.stuckTimer = 0.45 + Math.random() * 0.2;
    }

    // Height awareness: on Morpheus only jump to reach a genuinely higher target
    const heightDiff = targetPos.y - bp.y;
    bot.jumptimer -= dt;
    if (bot.jumptimer <= 0 && bot.onSurface) {
      if (currentMap === 2) {
        if (heightDiff > 1.35 && heightDiff < 9) {
          bot.velY = JUMP_SPEED * 0.72; bot.onSurface = false;
          bot.jumptimer = 0.9 + Math.random() * 0.8;
        } else {
          bot.jumptimer = 0.5 + Math.random() * 0.9;
        }
      } else {
        if (isClassicRulesetActive()) {
          if (heightDiff > 1.8 && dist > 6) {
            bot.velY = JUMP_SPEED * 0.68; bot.onSurface = false;
          }
          bot.jumptimer = heightDiff > 1.8 ? (0.85 + Math.random() * 1.25) : (2.2 + Math.random() * 2.4);
        } else {
          bot.velY = JUMP_SPEED * 0.7; bot.onSurface = false;
          bot.jumptimer = heightDiff > 2.5 ? 0.25 + Math.random() * 0.5
                        : heightDiff > 1.0 ? 0.7  + Math.random() * 1.0
                        :                    1.5   + Math.random() * 2.5;
        }
      }
    }

    bot.shootTimer -= dt;
    const classic = isClassicRulesetActive();
    const shootReach = classic ? 260 : INSTAGIB.range * 0.8;
    const canShootState = bot.aiState !== 'retreat' || (bot.health || 100) > 55 || dist < 7.5;
    if (bot.shootTimer <= 0 && dist < shootReach && hasLOS && canShootState) {
      botShoot(bot);
      const missDelay = bot.missPenaltyTimer > 0 ? bot.missPenaltyTimer : 0;
      let baseCd = classic ? (0.34 + Math.random() * 0.6) : (INSTAGIB.cooldown + 0.28 + Math.random() * 0.9);
      if (!classic && isInstagibPlusRulesetActive() && (bot.uDamageTimer || 0) > 0) baseCd *= 0.52;
      bot.shootTimer = (baseCd * activeBotPreset.shootDelayMul * diff.shootDelayMul) + missDelay;
    }

  bot.prevTargetPos = targetPos.clone();
  const liveLearn = navLearnState.training || navLearnState.alwaysLearn;
  if (liveLearn) {
      bot.navSampleTimer = (bot.navSampleTimer || 0) - dt;
      if (bot.navSampleTimer <= 0) {
        learnFromBotTrack(bot);
        bot.navSampleTimer = navLearnState.training
          ? (0.2 + Math.random() * 0.08)
          : (0.32 + Math.random() * 0.18);
        navLearnState.totalSamples++;
      }
      const simplifyEvery = navLearnState.training
        ? (navLearnState.bootstrapActive
            ? navLearnState.bootstrapConfig.simplifyEverySamples
            : navLearnState.stableConfig.simplifyEverySamples)
        : 600;
      const saveEvery = navLearnState.training
        ? (navLearnState.bootstrapActive
            ? navLearnState.bootstrapConfig.saveEverySamples
            : navLearnState.stableConfig.saveEverySamples)
        : 900;
      if ((navLearnState.totalSamples % simplifyEvery) === 0) simplifyNavGraph();
      if ((navLearnState.totalSamples % saveEvery) === 0) saveNavGraph();
    }
  }
  if (navOverlayState.visible) renderNavOverlay(false);
  updateBotNavDebugOverlay(dt);
}

function clearAllBots() {
  while (bots.length) {
    const b = bots.pop();
    scene.remove(b.mesh);
    if (b.mixer) {
      try { b.mixer.stopAllAction(); } catch (_) {}
    }
    b.mesh.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m && m.map) m.map.dispose();
          if (m) m.dispose();
        }
      }
    });
  }
}
window.clearAllBots = clearAllBots;

function disposeBotMesh(b) {
  scene.remove(b.mesh);
  if (b.mixer) {
    try { b.mixer.stopAllAction(); } catch (_) {}
  }
  b.mesh.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m && m.map) m.map.dispose();
        if (m) m.dispose();
      }
    }
  });
}

function clampBotCount(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_BOT_COUNT;
  return Math.max(0, Math.min(11, Math.round(n)));
}

function getDesiredBotCountFromConfig() {
  return clampBotCount(window.__TA_SP_BOT_COUNT || DEFAULT_BOT_COUNT);
}

function setBotCount(count) {
  const target = clampBotCount(count);
  while (bots.length > target) {
    const b = bots.pop();
    disposeBotMesh(b);
  }
  while (bots.length < target) {
    bots.push(spawnBot(bots.length));
  }
}

window.__TA_SET_BOT_COUNT = setBotCount;

// ── Init (runs after all scripts load) ───────────────────────────────────────

(async function initArenaAndBots() {
  try {
    await preloadBotModels();
  } catch (err) {
    console.warn('Bot GLB preload error — procedural bots.', err);
    botModelTemplates.length = 0;
  }
  buildArena();
  buildLights();
  for (let i = 0; i < getDesiredBotCountFromConfig(); i++) bots.push(spawnBot(i));
  applyWorldMaterialBoost();
})();
