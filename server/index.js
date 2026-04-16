'use strict';

const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { createAdminHandler } = require('./admin-routes.js');
const { MAPS } = require('./arena-maps.js');
const progression = require('./progression.js');
const hitscan = require('./hitscan.js');

/** Set after WebSocketServer is created — used to notify all connected clients of kills / round events. */
let broadcastToAllClients = null;

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
/** 25 Hz — smoother than 20 without flooding clients; pairs well with input throttle on the client. */
const TICK_HZ = 25;
const DT = 1 / TICK_HZ;

const SLOT_COUNT = 8;
const BOT_NAMES = ['Xan', 'Loque', 'Tamika', 'Kragoth', 'Cali', 'Malcolm', 'Dominator', 'Devastator'];
/** Mirrors bots.js BOT_SKILLS — accuracy / reaction. */
const BOT_SKILLS = [0.75, 0.65, 0.55, 0.6, 0.45, 0.7, 0.5, 0.35];
const GRAVITY = -28;
const JUMP_SPEED = 10;
const PLAYER_H = 2.2;
const MOVE_SPEED = 14;
const BOT_SPEED = 9;
const BOT_HEIGHT = 2.2;
/** Hitscan sphere center above feet — was 0.9 for everyone (correct for bots only); humans are PLAYER_H tall. */
function hitSphereCenterY(e) {
  return e.y + (e.isBot ? BOT_HEIGHT * 0.5 : PLAYER_H * 0.5);
}
const INSTAGIB_RANGE = hitscan.INSTAGIB_RANGE;
const INSTAGIB_CD = 0.7;
const ROUND_DURATION = 300;
const ROUND_INTERMISSION = 6;
const DODGE_IMPULSE = 22;
const SPAWN_INVULN = 3;

function resolveBoxCollision(pos, radius, height, boxes) {
  let landed = false;
  for (const bp of boxes) {
    const dx = pos.x - bp.x;
    const dz = pos.z - bp.z;
    const dy = pos.y - bp.y;
    const ox = bp.hw + radius - Math.abs(dx);
    const oz = bp.hd + radius - Math.abs(dz);
    const oy = bp.hh + height * 0.5 - Math.abs(dy);
    if (ox > 0 && oz > 0 && oy > 0) {
      if (ox < oz && ox < oy) pos.x += ox * Math.sign(dx);
      else if (oz < ox && oz < oy) pos.z += oz * Math.sign(dz);
      else {
        pos.y += oy * Math.sign(dy);
        if (dy > 0) landed = true;
      }
    }
  }
  return landed;
}

/** Ray vs axis-aligned box: closest positive entry t, or null. Origin should be outside for typical LoS. */
function rayAabbEnterT(ox, oy, oz, dx, dy, dz, maxT, bp) {
  const minx = bp.x - bp.hw;
  const maxx = bp.x + bp.hw;
  const miny = bp.y - bp.hh;
  const maxy = bp.y + bp.hh;
  const minz = bp.z - bp.hd;
  const maxz = bp.z + bp.hd;
  let t0 = 0;
  let t1 = maxT;
  const axes = [
    [ox, dx, minx, maxx],
    [oy, dy, miny, maxy],
    [oz, dz, minz, maxz],
  ];
  for (let i = 0; i < 3; i++) {
    const o = axes[i][0];
    const d = axes[i][1];
    const mn = axes[i][2];
    const mx = axes[i][3];
    if (Math.abs(d) < 1e-12) {
      if (o < mn || o > mx) return null;
      continue;
    }
    const inv = 1 / d;
    let ta = (mn - o) * inv;
    let tb = (mx - o) * inv;
    if (ta > tb) {
      const tmp = ta;
      ta = tb;
      tb = tmp;
    }
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  if (t1 < 0 || t0 > maxT) return null;
  const enter = t0 >= 0 ? t0 : t1;
  return enter >= 0 && enter <= maxT ? enter : null;
}

/**
 * Line-of-sight segment vs AABB list (default: full arena).
 * Bot-vs-SP parity: pass ARENA_BOXES_BOT_LOS so thin pillars match client bots.js (hw > 2 only).
 */
function losClear(ax, ay, az, bx, by, bz, boxList) {
  const boxes = boxList || MAPS[0].boxes;
  const rdx = bx - ax;
  const rdy = by - ay;
  const rdz = bz - az;
  const dist = Math.hypot(rdx, rdy, rdz);
  if (dist < 0.05) return true;
  const ix = rdx / dist;
  const iy = rdy / dist;
  const iz = rdz / dist;
  const margin = 0.85;
  const maxT = Math.max(0, dist - margin);
  if (maxT < 1e-3) return true;
  for (const bp of boxes) {
    const t = rayAabbEnterT(ax, ay, az, ix, iy, iz, maxT + 0.01, bp);
    if (t != null && t > 0.002 && t < maxT) return false;
  }
  return true;
}

class GameServer {
  constructor() {
    this.mapIdx = 0;
    this.entities = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      this.entities.push(this.createEntity(i, true, BOT_NAMES[i]));
    }
    this.roundTimer = ROUND_DURATION;
    this.roundActive = true;
    this.intermission = 0;
    this.tick = 0;
    /** Monotonic seconds (for bot reaction time — matches bots.js sawTargetAt). */
    this.simTime = 0;
  }

  currentMap() {
    return MAPS[this.mapIdx] || MAPS[0];
  }

  currentBoxes() {
    return this.currentMap().boxes || MAPS[0].boxes;
  }

  currentBotLosBoxes() {
    return this.currentBoxes().filter(b => b.hw > 2);
  }

  randomSpawn() {
    const spawns = this.currentMap().spawns || MAPS[0].spawns;
    const p = spawns[Math.floor(Math.random() * spawns.length)];
    return [p[0], p[1], p[2]];
  }

  createEntity(slot, isBot, name) {
    const sp = this.randomSpawn();
    return {
      slot,
      isBot,
      ws: null,
      name,
      x: sp[0],
      y: sp[1],
      z: sp[2],
      yaw: 0,
      pitch: 0,
      velY: 0,
      alive: true,
      respawnT: 0,
      kills: 0,
      deaths: 0,
      shootCd: 0,
      invuln: 0,
      inW: false,
      inA: false,
      inS: false,
      inD: false,
      jumpQueued: false,
      targetSlot: -1,
      strafeSign: Math.random() < 0.5 ? -1 : 1,
      shootTimer: 1.5 + Math.random() * 2,
      retargetTimer: 0,
      jumptimer: 1 + Math.random(),
      onGround: false,
      canDoubleJump: true,
      dodgeCooldown: 0,
      dodgeVx: 0,
      dodgeVz: 0,
      playerId: null,
      skill: BOT_SKILLS[slot] ?? 0.5,
      botSawTargetAt: -1,
      prevTgtX: null,
      prevTgtY: null,
      prevTgtZ: null,
      posHistory: [],
    };
  }

  resetPosHistory(e) {
    e.posHistory = [{ t: this.simTime, x: e.x, y: hitSphereCenterY(e), z: e.z }];
  }

  findFreeBotSlot() {
    for (const e of this.entities) {
      if (e.isBot && e.ws == null) return e;
    }
    return null;
  }

  attachHuman(ws, name, playerId) {
    const e = this.findFreeBotSlot();
    if (!e) return null;
    e.isBot = false;
    e.ws = ws;
    e.name = (name && String(name).trim().slice(0, 20)) || 'Player';
    e.playerId = progression.sanitizePlayerId(playerId) || null;
    const sp = this.randomSpawn();
    e.x = sp[0];
    e.y = sp[1];
    e.z = sp[2];
    e.alive = true;
    e.velY = 0;
    e.respawnT = 0;
    e.invuln = SPAWN_INVULN;
    e.canDoubleJump = true;
    e.dodgeCooldown = 0;
    e.dodgeVx = 0;
    e.dodgeVz = 0;
    this.resetPosHistory(e);
    return e;
  }

  detachHuman(ws) {
    for (const e of this.entities) {
      if (e.ws === ws) {
        e.isBot = true;
        e.ws = null;
        e.name = BOT_NAMES[e.slot];
        e.shootTimer = 1.5 + Math.random() * 2;
        e.retargetTimer = 0;
        e.targetSlot = -1;
        const sp = this.randomSpawn();
        e.x = sp[0];
        e.y = sp[1];
        e.z = sp[2];
        e.alive = true;
        e.velY = 0;
        e.canDoubleJump = true;
        e.dodgeCooldown = 0;
        e.dodgeVx = 0;
        e.dodgeVz = 0;
        e.playerId = null;
        e.botSawTargetAt = -1;
        e.prevTgtX = null;
        e.prevTgtY = null;
        e.prevTgtZ = null;
        this.resetPosHistory(e);
        return;
      }
    }
  }

  kickSlot(slot) {
    const e = this.entities.find(x => x.slot === slot);
    if (!e || !e.ws) return false;
    try {
      e.ws.close();
    } catch (_) {}
    return true;
  }

  adminForceEndRound() {
    if (this.intermission > 0 || !this.roundActive) return false;
    this.roundActive = false;
    this.intermission = ROUND_INTERMISSION;
    const ranks = this.entities
      .map(en => ({ name: en.name, kills: en.kills, deaths: en.deaths, slot: en.slot }))
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    if (broadcastToAllClients) broadcastToAllClients({ t: 'round_end', ranks });
    progression.onRoundEnd(this, ranks);
    return true;
  }

  adminAddRoundTime(seconds) {
    const s = Number(seconds);
    if (!Number.isFinite(s)) return;
    this.roundTimer = Math.max(0, this.roundTimer + s);
  }

  adminTeleportAll() {
    for (const e of this.entities) {
      const sp = this.randomSpawn();
      e.x = sp[0];
      e.y = sp[1];
      e.z = sp[2];
      e.velY = 0;
      e.onGround = true;
      e.canDoubleJump = true;
      e.dodgeVx = 0;
      e.dodgeVz = 0;
      this.resetPosHistory(e);
    }
    this.broadcastSnap();
  }

  pickBotTarget(bot) {
    let best = -1;
    let bestD = 1e9;
    for (const o of this.entities) {
      if (o.slot === bot.slot || !o.alive) continue;
      const dx = o.x - bot.x;
      const dy = o.y - bot.y;
      const dz = o.z - bot.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = o.slot;
      }
    }
    bot.targetSlot = best;
  }

  simulateEntity(dt, e) {
    if (!e.alive) {
      e.respawnT -= dt;
      if (e.respawnT <= 0) {
        const sp = this.randomSpawn();
        e.x = sp[0];
        e.y = sp[1];
        e.z = sp[2];
        e.alive = true;
        e.velY = 0;
        e.invuln = SPAWN_INVULN;
        e.shootCd = 0;
        e.canDoubleJump = true;
        e.dodgeCooldown = 0;
        e.dodgeVx = 0;
        e.dodgeVz = 0;
        e.botSawTargetAt = -1;
        e.prevTgtX = null;
        e.prevTgtY = null;
        e.prevTgtZ = null;
        this.resetPosHistory(e);
      }
      return;
    }

    e.invuln = Math.max(0, e.invuln - dt);
    e.shootCd = Math.max(0, e.shootCd - dt);

    if (e.isBot) {
      this.simulateBot(dt, e);
    } else {
      this.simulateHuman(dt, e);
    }

    const b = this.currentMap().bounds || MAPS[0].bounds;
    const bx = Math.max(-b[0], Math.min(b[0], e.x));
    const bz = Math.max(-b[1], Math.min(b[1], e.z));
    e.x = bx;
    e.z = bz;
  }

  simulateHuman(dt, e) {
    e.dodgeCooldown = Math.max(0, e.dodgeCooldown - dt);

    if (e.jumpQueued) {
      if (e.onGround) {
        e.velY = JUMP_SPEED;
        e.onGround = false;
      } else if (e.canDoubleJump) {
        e.velY = JUMP_SPEED * 0.85;
        e.canDoubleJump = false;
      }
    }
    e.jumpQueued = false;

    e.dodgeVx *= Math.max(0, 1 - 8 * dt);
    e.dodgeVz *= Math.max(0, 1 - 8 * dt);

    const yaw = e.yaw;
    const fwdX = -Math.sin(yaw);
    const fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    let mx = 0;
    let mz = 0;
    if (e.inW) {
      mx += fwdX;
      mz += fwdZ;
    }
    if (e.inS) {
      mx -= fwdX;
      mz -= fwdZ;
    }
    if (e.inA) {
      mx -= rightX;
      mz -= rightZ;
    }
    if (e.inD) {
      mx += rightX;
      mz += rightZ;
    }
    const len = Math.hypot(mx, mz);
    if (len > 0.001) {
      mx = (mx / len) * MOVE_SPEED * dt;
      mz = (mz / len) * MOVE_SPEED * dt;
    }

    mx += e.dodgeVx * dt;
    mz += e.dodgeVz * dt;

    e.velY += GRAVITY * dt;
    const pos = { x: e.x + mx, y: e.y + e.velY * dt, z: e.z + mz };
    const landed = resolveBoxCollision(pos, 0.45, PLAYER_H, this.currentBoxes());
    if (pos.y <= PLAYER_H / 2) {
      pos.y = PLAYER_H / 2;
      if (e.velY < 0) {
        e.velY = 0;
        e.onGround = true;
        e.canDoubleJump = true;
      }
    } else {
      e.onGround = landed;
      if (landed && e.velY < 0) {
        e.velY = 0;
        e.canDoubleJump = true;
      }
    }

    e.x = pos.x;
    e.y = pos.y;
    e.z = pos.z;
  }

  simulateBot(dt, e) {
    e.retargetTimer -= dt;
    if (e.retargetTimer <= 0 || e.targetSlot < 0) {
      this.pickBotTarget(e);
      e.retargetTimer = 1.5 + Math.random() * 2;
    }

    let tx = e.x;
    let tz = e.z;
    let ty = e.y;
    const tgt = this.entities.find(x => x.slot === e.targetSlot);
    if (tgt && tgt.alive) {
      tx = tgt.x;
      ty = tgt.y;
      tz = tgt.z;
    }

    const dx = tx - e.x;
    const dz = tz - e.z;
    const dist = Math.hypot(dx, dz) || 1;
    const toX = dx / dist;
    const toZ = dz / dist;
    const rx = -toZ * e.strafeSign;
    const rz = toX * e.strafeSign;
    const ff = dist > 14 ? 1 : dist < 5 ? -0.6 : 0;
    let mx = toX * ff + rx * 0.7;
    let mz = toZ * ff + rz * 0.7;
    const ml = Math.hypot(mx, mz);
    if (ml > 0.001) {
      mx = (mx / ml) * BOT_SPEED * dt;
      mz = (mz / ml) * BOT_SPEED * dt;
    }

    e.velY += GRAVITY * dt;
    const pos = { x: e.x + mx, y: e.y + e.velY * dt, z: e.z + mz };
    e.onGround = false;
    if (pos.y <= BOT_HEIGHT / 2) {
      pos.y = BOT_HEIGHT / 2;
      if (e.velY < 0) {
        e.velY = 0;
        e.onGround = true;
      }
    }
    const landed = resolveBoxCollision(pos, 0.5, BOT_HEIGHT, this.currentBoxes());
    if (landed && e.velY < 0) {
      e.velY = 0;
      e.onGround = true;
    }
    e.x = pos.x;
    e.y = pos.y;
    e.z = pos.z;

    if (tgt && tgt.alive) {
      e.yaw = Math.atan2(-(tx - e.x), -(tz - e.z)) + Math.PI;
    }

    e.jumptimer -= dt;
    if (e.jumptimer <= 0 && e.onGround) {
      e.velY = JUMP_SPEED * 0.7;
      e.onGround = false;
      e.jumptimer = 1.2 + Math.random() * 2;
    }

    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && tgt && tgt.alive && dist < INSTAGIB_RANGE * 0.8) {
      this.botTryShootLikeSingleplayer(e, tgt);
      e.shootTimer = INSTAGIB_CD + 0.5 + Math.random() * 1.2;
    }

    if (tgt && tgt.alive) {
      e.prevTgtX = tgt.x;
      e.prevTgtY = hitSphereCenterY(tgt);
      e.prevTgtZ = tgt.z;
    } else {
      e.prevTgtX = null;
      e.prevTgtY = null;
      e.prevTgtZ = null;
    }
  }

  /**
   * Matches bots.js botShoot: thick-wall LOS only, reaction delay, lead, distance spread.
   */
  botTryShootLikeSingleplayer(e, tgt) {
    const ox = e.x;
    const oy = e.y + BOT_HEIGHT * 0.85;
    const oz = e.z;
    const tcx = tgt.x;
    const tcy = hitSphereCenterY(tgt);
    const tcz = tgt.z;

    if (!losClear(ox, oy, oz, tcx, tcy, tcz, this.currentBotLosBoxes())) {
      e.botSawTargetAt = -1;
      return;
    }
    if (e.botSawTargetAt < 0) e.botSawTargetAt = this.simTime;
    const react = 0.4 - e.skill * 0.25;
    if (this.simTime - e.botSawTargetAt < react) return;

    let tx = tcx;
    let ty = tcy;
    let tz = tcz;
    if (e.prevTgtX != null && Number.isFinite(e.prevTgtX)) {
      const leadK = (0.05 + e.skill * 0.1) * TICK_HZ;
      tx += (tcx - e.prevTgtX) * leadK;
      ty += (tcy - e.prevTgtY) * leadK;
      tz += (tcz - e.prevTgtZ) * leadK;
    }

    const tdx = tx - ox;
    const tdy = ty - oy;
    const tdz = tz - oz;
    const shotDist = Math.hypot(tdx, tdy, tdz) || 1;
    let rdx = tdx / shotDist;
    let rdy = tdy / shotDist;
    let rdz = tdz / shotDist;
    const baseSpread = 0.32 - e.skill * 0.18;
    const spread = baseSpread * Math.min(1.6, 0.5 + shotDist / 55);
    rdx += (Math.random() - 0.5) * spread;
    rdy += (Math.random() - 0.5) * spread * 0.4;
    rdz += (Math.random() - 0.5) * spread;
    const rlen = Math.hypot(rdx, rdy, rdz) || 1;
    rdx /= rlen;
    rdy /= rlen;
    rdz /= rlen;

    this.tryInstagibHit(e, ox, oy, oz, rdx, rdy, rdz);
  }

  tryInstagibHit(shooter, ox, oy, oz, dx, dy, dz) {
    return this.tryInstagibHitAtTime(shooter, ox, oy, oz, dx, dy, dz, this.simTime);
  }

  sampleEntityPosAt(entity, tSec) {
    const h = entity.posHistory;
    if (!h || h.length === 0) {
      return { x: entity.x, y: hitSphereCenterY(entity), z: entity.z };
    }
    if (tSec <= h[0].t) return { x: h[0].x, y: h[0].y, z: h[0].z };
    const last = h[h.length - 1];
    if (tSec >= last.t) return { x: last.x, y: last.y, z: last.z };
    for (let i = h.length - 2; i >= 0; i--) {
      const a = h[i];
      const b = h[i + 1];
      if (tSec >= a.t && tSec <= b.t) {
        const span = Math.max(1e-6, b.t - a.t);
        const u = (tSec - a.t) / span;
        return {
          x: a.x + (b.x - a.x) * u,
          y: a.y + (b.y - a.y) * u,
          z: a.z + (b.z - a.z) * u,
        };
      }
    }
    return { x: last.x, y: last.y, z: last.z };
  }

  tryInstagibHitAtTime(shooter, ox, oy, oz, dx, dy, dz, sampleTimeSec) {
    let best = null;
    let bestT = Infinity;
    for (const v of this.entities) {
      if (v.slot === shooter.slot || !v.alive || v.invuln > 0) continue;
      const p = this.sampleEntityPosAt(v, sampleTimeSec);
      const px = p.x;
      const py = p.y;
      const pz = p.z;
      const r = hitscan.raySphere(ox, oy, oz, dx, dy, dz, px, py, pz, hitscan.HIT_SPHERE_R);
      if (r.hit && r.t < bestT) {
        bestT = r.t;
        best = v;
      }
    }
    if (best) this.applyKill(shooter, best);
  }

  /**
   * Human fire — use dedicated `fire` WS message with camera aim (see mp-client), not throttled `input.shoot`.
   */
  humanFire(e, msg) {
    if (e.shootCd > 0 || !e.alive) return;
    const { clientDir, clientOrigin } = hitscan.aimFromFireMessage(msg);
    const ray = hitscan.resolveHumanFireRay(e, clientDir, clientOrigin);
    e.shootCd = INSTAGIB_CD;
    const rttMsRaw = Number(msg && msg.rttMs);
    const rttMs = Number.isFinite(rttMsRaw) ? Math.max(0, Math.min(280, rttMsRaw)) : 0;
    const rewindSec = Math.max(0, Math.min(0.2, rttMs * 0.5 / 1000 + DT * 0.5));
    const sampleTime = Math.max(0, this.simTime - rewindSec);
    this.tryInstagibHitAtTime(e, ray.ox, ray.oy, ray.oz, ray.dx, ray.dy, ray.dz, sampleTime);
  }

  applyKill(killer, victim) {
    victim.alive = false;
    victim.deaths++;
    victim.respawnT = 1.5;
    killer.kills++;
    progression.onKill(killer, victim);
    if (broadcastToAllClients) {
      broadcastToAllClients({
        t: 'kill',
        killerSlot: killer.slot,
        victimSlot: victim.slot,
      });
    }
  }

  tickRound(dt) {
    if (this.intermission > 0) {
      this.intermission -= dt;
      if (this.intermission <= 0) {
        this.startRound();
      }
      return;
    }
    if (!this.roundActive) return;
    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundActive = false;
      this.intermission = ROUND_INTERMISSION;
      const ranks = this.entities
        .map(e => ({ name: e.name, kills: e.kills, deaths: e.deaths, slot: e.slot }))
        .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
      if (broadcastToAllClients) broadcastToAllClients({ t: 'round_end', ranks });
      progression.onRoundEnd(this, ranks);
    }
  }

  startRound() {
    this.mapIdx = (this.mapIdx + 1) % MAPS.length;
    this.roundTimer = ROUND_DURATION;
    this.roundActive = true;
    this.intermission = 0;
    for (const e of this.entities) {
      const sp = this.randomSpawn();
      e.x = sp[0];
      e.y = sp[1];
      e.z = sp[2];
      e.kills = 0;
      e.deaths = 0;
      e.alive = true;
      e.velY = 0;
      e.respawnT = 0;
      e.canDoubleJump = true;
      e.dodgeCooldown = 0;
      e.dodgeVx = 0;
      e.dodgeVz = 0;
      e.shootTimer = 1.5 + Math.random() * 2;
      e.botSawTargetAt = -1;
      e.prevTgtX = null;
      e.prevTgtY = null;
      e.prevTgtZ = null;
      this.resetPosHistory(e);
    }
    if (broadcastToAllClients) broadcastToAllClients({ t: 'round_start' });
  }

  snapshot() {
    return {
      t: 'snap',
      tick: this.tick,
      serverNow: this.simTime,
      mapIdx: this.mapIdx,
      roundTimer: Math.max(0, this.roundTimer),
      roundActive: this.roundActive,
      intermission: this.intermission,
      entities: this.entities.map(e => ({
        slot: e.slot,
        isBot: e.isBot,
        name: e.name,
        x: e.x,
        y: e.y,
        z: e.z,
        yaw: e.yaw,
        pitch: e.pitch,
        alive: e.alive,
        kills: e.kills,
        deaths: e.deaths,
        shootCd: e.shootCd,
        onGround: !!e.onGround,
      })),
    };
  }

  broadcastSnap() {
    const snap = JSON.stringify(this.snapshot());
    for (const e of this.entities) {
      if (e.ws) e.ws.send(snap);
    }
  }

  runTick() {
    this.tick++;
    this.simTime += DT;
    for (const e of this.entities) {
      this.simulateEntity(DT, e);
      const hy = hitSphereCenterY(e);
      if (!e.posHistory) e.posHistory = [];
      e.posHistory.push({ t: this.simTime, x: e.x, y: hy, z: e.z });
      while (e.posHistory.length > 2 && this.simTime - e.posHistory[0].t > 1.0) {
        e.posHistory.shift();
      }
    }
    this.tickRound(DT);
    this.broadcastSnap();
  }
}

const game = new GameServer();
const httpServer = http.createServer();
const wss = new WebSocketServer({ server: httpServer });
const adminHandler = createAdminHandler(game, wss);

httpServer.on('request', async (req, res) => {
  try {
    const handled = await adminHandler(req, res);
    if (!handled) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  } catch (err) {
    console.error('[MP server] HTTP', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error');
    }
  }
});

httpServer.on('error', err => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(
      `[MP server] Port ${PORT} is already in use (another process or a previous server instance).\n` +
        `  • Stop the other process, or use another port, e.g.:\n` +
        `    CMD:     set PORT=8081 && npm run server\n` +
        `    PowerShell:  $env:PORT=8081; npm run server`
    );
    process.exit(1);
  }
  console.error('[MP server]', err);
  process.exit(1);
});

wss.on('error', err => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(
      `[MP server] Port ${PORT} is already in use (another process or a previous server instance).\n` +
        `  • Stop the other process, or use another port, e.g.:\n` +
        `    CMD:     set PORT=8081 && npm run server\n` +
        `    PowerShell:  $env:PORT=8081; npm run server`
    );
    process.exit(1);
  }
  console.error('[MP server]', err);
  process.exit(1);
});

broadcastToAllClients = obj => {
  const s = JSON.stringify(obj);
  wss.clients.forEach(c => {
    if (c.readyState === 1) c.send(s);
  });
};

wss.on('connection', (ws, req) => {
  const ipHeader = req.headers['x-forwarded-for'];
  const ip = (ipHeader ? ipHeader.split(',')[0].trim() : req.socket.remoteAddress) || 'unknown';

  ws.on('message', raw => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (_) {
      return;
    }
    if (msg.t === 'hello') {
      const name = (msg.name && String(msg.name).trim().slice(0, 20)) || 'Player';
      const uniqueId = crypto.createHash('sha256').update(name + '_' + ip).digest('hex').substring(0, 32);
      const ent = game.attachHuman(ws, name, uniqueId);
      if (!ent) {
        ws.send(JSON.stringify({ t: 'deny', reason: 'Arena full (8 humans).' }));
        ws.close();
        return;
      }
      const progress = ent.playerId
        ? progression.progressPayloadForPlayer(ent.playerId)
        : { totalXp: 0, level: 1, xpInLevel: 0, xpForNextLevel: progression.xpNeededToAdvance(1) };
      ws.send(
        JSON.stringify({
          t: 'welcome',
          slot: ent.slot,
          snap: game.snapshot(),
          progress,
        })
      );
      game.broadcastSnap();
      return;
    }
    if (msg.t === 'fire') {
      for (const e of game.entities) {
        if (e.ws !== ws || e.isBot) continue;
        game.humanFire(e, msg);
        break;
      }
      return;
    }
    if (msg.t === 'ping') {
      ws.send(
        JSON.stringify({
          t: 'pong',
          id: msg.id,
          clientTs: msg.clientTs,
          serverNow: game.simTime,
        })
      );
      return;
    }
    if (msg.t === 'input') {
      for (const e of game.entities) {
        if (e.ws !== ws || e.isBot) continue;
        if (msg.yaw != null) e.yaw = Number(msg.yaw);
        if (msg.pitch != null) e.pitch = Math.max(-1.4, Math.min(1.4, Number(msg.pitch)));
        e.inW = !!msg.w;
        e.inA = !!msg.a;
        e.inS = !!msg.s;
        e.inD = !!msg.d;
        if (msg.jump) e.jumpQueued = true;
        if (msg.dodgeDir && typeof msg.dodgeDir === 'string') {
          const d = msg.dodgeDir.toLowerCase();
          if (
            (d === 'w' || d === 'a' || d === 's' || d === 'd') &&
            e.dodgeCooldown <= 0 &&
            e.onGround &&
            e.alive
          ) {
            const yaw = e.yaw;
            const fX = -Math.sin(yaw);
            const fZ = -Math.cos(yaw);
            const rX = Math.cos(yaw);
            const rZ = -Math.sin(yaw);
            let dx = 0;
            let dz = 0;
            if (d === 'w') {
              dx += fX;
              dz += fZ;
            } else if (d === 's') {
              dx -= fX;
              dz -= fZ;
            } else if (d === 'a') {
              dx -= rX;
              dz -= rZ;
            } else if (d === 'd') {
              dx += rX;
              dz += rZ;
            }
            const L = Math.hypot(dx, dz);
            if (L > 0.001) {
              e.dodgeVx = (dx / L) * DODGE_IMPULSE;
              e.dodgeVz = (dz / L) * DODGE_IMPULSE;
              e.velY = 4.5;
              e.onGround = false;
              e.dodgeCooldown = 0.5;
            }
          }
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    game.detachHuman(ws);
    game.broadcastSnap();
  });
});

setInterval(() => game.runTick(), 1000 / TICK_HZ);

httpServer.listen(PORT, () => {
  console.log(
    `Polystrike Arena MP server — WebSocket ws://0.0.0.0:${PORT} · HTTP admin http://localhost:${PORT}/admin (${SLOT_COUNT} slots, bots fill empty seats)`
  );
});
