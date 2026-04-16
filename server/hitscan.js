'use strict';

/**
 * Shared instagib math + human fire resolution (client-reported aim vs authoritative body).
 * Keeps ray/sphere tests and drift limits in one place for multiplayer hit registration.
 */

const CAM_HEIGHT = 0.8;
const INSTAGIB_RANGE = 500;
/** Eye vs feet offset can disagree when the client lerps — allow generous slack. */
const MAX_SHOOT_ORIGIN_DRIFT = 10;
/** Slightly forgiving vs network + snapshot error (SP ray uses mesh hitbox ~0.7–0.8). */
const HIT_SPHERE_R = 0.88;

function dirFromYawPitch(yaw, pitch) {
  const c = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * c,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * c,
  };
}

function normalizeDir(x, y, z) {
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

function raySphere(ox, oy, oz, dx, dy, dz, px, py, pz, r) {
  const vx = ox - px;
  const vy = oy - py;
  const vz = oz - pz;
  const a = dx * dx + dy * dy + dz * dz;
  if (a < 1e-12) return { hit: false, t: Infinity };
  const b = 2 * (vx * dx + vy * dy + vz * dz);
  const c = vx * vx + vy * vy + vz * vz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return { hit: false, t: Infinity };
  const s = Math.sqrt(disc);
  let t = (-b - s) / (2 * a);
  if (t < 0) t = (-b + s) / (2 * a);
  if (t < 0 || t > INSTAGIB_RANGE) return { hit: false, t: Infinity };
  return { hit: true, t };
}

/**
 * Server eye from authoritative feet position.
 */
function serverEye(e) {
  return { x: e.x, y: e.y + CAM_HEIGHT, z: e.z };
}

/**
 * Build world-space ray for a human shot: direction from client when valid, else yaw/pitch.
 * Origin from client when within drift of server eye, else server eye.
 */
function resolveHumanFireRay(e, clientDir, clientOrigin) {
  const se = serverEye(e);
  let dx;
  let dy;
  let dz;
  if (clientDir && [clientDir.x, clientDir.y, clientDir.z].every(Number.isFinite)) {
    const n = normalizeDir(clientDir.x, clientDir.y, clientDir.z);
    dx = n.x;
    dy = n.y;
    dz = n.z;
  } else {
    const d = dirFromYawPitch(e.yaw, e.pitch);
    const n = normalizeDir(d.x, d.y, d.z);
    dx = n.x;
    dy = n.y;
    dz = n.z;
  }
  let ox = se.x;
  let oy = se.y;
  let oz = se.z;
  if (clientOrigin && [clientOrigin.x, clientOrigin.y, clientOrigin.z].every(Number.isFinite)) {
    const drift = Math.hypot(clientOrigin.x - se.x, clientOrigin.y - se.y, clientOrigin.z - se.z);
    if (drift <= MAX_SHOOT_ORIGIN_DRIFT) {
      ox = clientOrigin.x;
      oy = clientOrigin.y;
      oz = clientOrigin.z;
    }
  }
  return { ox, oy, oz, dx, dy, dz };
}

function aimFromFireMessage(msg) {
  let clientDir = null;
  if (msg.sdx != null && msg.sdy != null && msg.sdz != null) {
    const x = Number(msg.sdx);
    const y = Number(msg.sdy);
    const z = Number(msg.sdz);
    if ([x, y, z].every(Number.isFinite)) clientDir = { x, y, z };
  }
  let clientOrigin = null;
  if (msg.sox != null && msg.soy != null && msg.soz != null) {
    const x = Number(msg.sox);
    const y = Number(msg.soy);
    const z = Number(msg.soz);
    if ([x, y, z].every(Number.isFinite)) clientOrigin = { x, y, z };
  }
  return { clientDir, clientOrigin };
}

module.exports = {
  CAM_HEIGHT,
  INSTAGIB_RANGE,
  MAX_SHOOT_ORIGIN_DRIFT,
  HIT_SPHERE_R,
  dirFromYawPitch,
  raySphere,
  resolveHumanFireRay,
  aimFromFireMessage,
};
