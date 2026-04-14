/**
 * Gothic arena (map 0) — collision boxes matching maps.js buildArena addBox() + pillars.
 * Center-format: { x, y, z, hw, hh, hd } half-extents like arenaObjects.
 */
'use strict';

const SPAWN_POINTS = [
  [0, 5.5, 0], [-28, 4, -28], [28, 4, -28], [-28, 4, 28], [28, 4, 28],
  [-42, 6.5, 0], [42, 6.5, 0], [0, 6.5, -42], [0, 6.5, 42],
  [-15, 1, 15], [15, 1, 15], [-15, 1, -15], [15, 1, -15],
  [0, 1, 20], [0, 1, -20], [20, 1, 0], [-20, 1, 0],
];

const MAP_BOUNDS = [57, 57];

function addBox(arr, x, y, z, w, h, d) {
  arr.push({ x, y, z, hw: w / 2, hh: h / 2, hd: d / 2 });
}

const ARENA_BOXES = [];
// Outer walls
addBox(ARENA_BOXES, -58, 9, 0, 2, 18, 120);
addBox(ARENA_BOXES, 58, 9, 0, 2, 18, 120);
addBox(ARENA_BOXES, 0, 9, -58, 120, 18, 2);
addBox(ARENA_BOXES, 0, 9, 58, 120, 18, 2);
// Platforms
for (const a of [
  [0, 4, 0, 18, 1, 18], [-28, 2.5, -28, 12, 1, 12], [28, 2.5, -28, 12, 1, 12],
  [-28, 2.5, 28, 12, 1, 12], [28, 2.5, 28, 12, 1, 12],
  [-42, 5, 0, 8, 1, 20], [42, 5, 0, 8, 1, 20],
  [0, 5, -42, 20, 1, 8], [0, 5, 42, 20, 1, 8],
]) {
  addBox(ARENA_BOXES, a[0], a[1], a[2], a[3], a[4], a[5]);
}
// Ring pillars
for (let i = 0; i < 6; i++) {
  const ang = (i / 6) * Math.PI * 2;
  addBox(ARENA_BOXES, Math.cos(ang) * 14, 3.5, Math.sin(ang) * 14, 2, 7, 2);
}
// Crates
for (const a of [
  [-18, 1, -18, 5, 2, 5], [18, 1, -18, 5, 2, 5], [-18, 1, 18, 5, 2, 5], [18, 1, 18, 5, 2, 5],
  [0, 1, -30, 6, 2, 6], [0, 1, 30, 6, 2, 6], [-30, 1, 0, 6, 2, 6], [30, 1, 0, 6, 2, 6],
]) {
  addBox(ARENA_BOXES, a[0], a[1], a[2], a[3], a[4], a[5]);
}

module.exports = { ARENA_BOXES, SPAWN_POINTS, MAP_BOUNDS };
