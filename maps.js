// ═══════════════════════════════════════════════════════════════════════════════
// MAPS — textures, skybox, arena builders, spawn configuration
// Requires: scene, THREE (from game.js, loaded before this file)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Collision and scene tracking arrays ───────────────────────────────────────
const arenaObjects = []; // collision: { mesh, hw, hh, hd }
const arenaMeshes  = []; // all Three.js objects for the current map

function sceneAddArena(obj) {
  scene.add(obj);
  arenaMeshes.push(obj);
  return obj;
}

/** After map load: slightly stronger IBL on all MeshStandard (arena + bots). */
function applyWorldMaterialBoost() {
  scene.traverse(obj => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (m && m.isMeshStandardMaterial) {
        // Normalize extremes: keeps materials consistent across texture sheets/maps.
        if (typeof m.roughness === 'number') m.roughness = THREE.MathUtils.clamp(m.roughness, 0.18, 0.92);
        if (typeof m.metalness === 'number') m.metalness = THREE.MathUtils.clamp(m.metalness, 0.04, 0.9);
        m.envMapIntensity = m.metalness > 0.45 ? 1.35 : 1.16;
        m.needsUpdate = true;
      }
    }
  });
}

/** Soft rim/back fill: more depth and readable silhouettes (no extra shadows). */
function addRimFillLights() {
  const rim = new THREE.DirectionalLight(0x7a90c8, 0.2);
  rim.position.set(-42, 26, -32);
  sceneAddArena(rim);
  const bounce = new THREE.DirectionalLight(0xc8b8a8, 0.1);
  bounce.position.set(38, 14, 40);
  sceneAddArena(bounce);
}

function clearArena() {
  for (const obj of arenaMeshes) {
    scene.remove(obj);
    if (obj.isMesh || obj.isLine || obj.isPoints) {
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
    }
  }
  arenaMeshes.length = 0;
  arenaObjects.length = 0;
}

// ── Procedural texture generators ─────────────────────────────────────────────

function makeTex(drawFn, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawFn(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function seededRng(seed) {
  let s = seed | 0;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function texGothicFloor() {
  const rng = seededRng(1337);
  return makeTex((ctx, s) => {
    ctx.fillStyle = '#2a1e14'; ctx.fillRect(0, 0, s, s);
    const rows = 4, cols = 4, gap = 4, bw = s / cols, bh = s / rows;
    for (let r = 0; r < rows; r++) {
      const ox = (r % 2) * bw / 2;
      for (let c = -1; c <= cols; c++) {
        const x = c * bw + ox + gap * 0.5, y = r * bh + gap * 0.5;
        const w = bw - gap, h = bh - gap;
        const v = rng() * 18 - 9;
        ctx.fillStyle = `rgb(${(54 + v) | 0},${(44 + v) | 0},${(34 + v) | 0})`;
        ctx.fillRect(x, y, w, h);
        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, 'rgba(255,255,255,0.05)');
        g.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      }
    }
  });
}

function texGothicWall() {
  const rng = seededRng(2674);
  return makeTex((ctx, s) => {
    ctx.fillStyle = '#1e1308'; ctx.fillRect(0, 0, s, s);
    const rows = 6, cols = 4, gap = 3, bw = s / cols, bh = s / rows;
    for (let r = 0; r < rows; r++) {
      const ox = (r % 2) * bw / 2;
      for (let c = -1; c <= cols; c++) {
        const x = c * bw + ox + gap * 0.5, y = r * bh + gap * 0.5;
        const w = bw - gap, h = bh - gap;
        const v = rng() * 14 - 7;
        ctx.fillStyle = `rgb(${(65 + v) | 0},${(52 + v) | 0},${(38 + v) | 0})`;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(x + 1, y + 1, w * 0.6, h * 0.5);
      }
    }
  });
}

function texMetalPlate(tint = '#1a1e26') {
  return makeTex((ctx, s) => {
    ctx.fillStyle = tint; ctx.fillRect(0, 0, s, s);
    const cols = 2, rows = 2, gap = 5, pw = s / cols, ph = s / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c * pw + gap * 0.5, y = r * ph + gap * 0.5;
      const w = pw - gap, h = ph - gap;
      ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(90,120,180,0.22)'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(x + 3, y + h * (0.15 + i * 0.22), w - 6, 1);
      }
    }
    ctx.fillStyle = 'rgba(50,80,130,0.12)';
    for (let c = 1; c < cols; c++) ctx.fillRect(c * pw - 1, 0, 3, s);
    for (let r = 1; r < rows; r++) ctx.fillRect(0, r * ph - 1, s, 3);
  });
}

function texMetalGrate() {
  return makeTex((ctx, s) => {
    ctx.fillStyle = '#0a0c12'; ctx.fillRect(0, 0, s, s);
    const cells = 10, cw = s / cells;
    ctx.fillStyle = 'rgba(30,45,70,0.85)';
    for (let i = 0; i <= cells; i++) {
      ctx.fillRect(i * cw - 1, 0, 3, s); ctx.fillRect(0, i * cw - 1, s, 3);
    }
    ctx.fillStyle = 'rgba(70,100,150,0.3)';
    for (let i = 0; i <= cells; i++) {
      ctx.fillRect(i * cw - 1, 0, 1, s); ctx.fillRect(0, i * cw - 1, s, 1);
    }
  });
}

function texIndustrialWall() {
  const rng = seededRng(8821);
  return makeTex((ctx, s) => {
    ctx.fillStyle = '#14192a'; ctx.fillRect(0, 0, s, s);
    const panels = 4, ph = s / panels;
    for (let p = 0; p < panels; p++) {
      const y = p * ph;
      const base = p % 2 === 0 ? 26 : 22;
      ctx.fillStyle = `rgb(${base},${base + 6},${base + 18})`;
      ctx.fillRect(0, y, s, ph - 2);
      ctx.fillStyle = 'rgba(70,100,160,0.2)'; ctx.fillRect(0, y, s, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, y + ph - 3, s, 3);
      const rivX = [s * 0.08, s * 0.28, s * 0.5, s * 0.72, s * 0.92];
      for (const rx of rivX) {
        const ry = y + ph * 0.5, v = rng() * 4 - 2;
        ctx.fillStyle = `rgb(${(45 + v) | 0},${(65 + v) | 0},${(100 + v) | 0})`;
        ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(150,200,255,0.4)';
        ctx.beginPath(); ctx.arc(rx - 1, ry - 1, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  });
}

function texWhiteMarble() {
  const rng = seededRng(9983);
  return makeTex((ctx, s) => {
    ctx.fillStyle = '#c8c4c0'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 8; i++) {
      const v = rng() * 14 - 7;
      ctx.fillStyle = `rgba(${(220 + v) | 0},${(216 + v) | 0},${(210 + v) | 0},0.25)`;
      ctx.fillRect(rng() * s, rng() * s, rng() * s * 0.6 + s * 0.2, rng() * s * 0.4 + s * 0.1);
    }
    ctx.strokeStyle = 'rgba(140,135,128,0.45)'; ctx.lineWidth = 1.5;
    for (const lp of [s / 2]) {
      ctx.beginPath(); ctx.moveTo(lp, 0); ctx.lineTo(lp, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, lp); ctx.lineTo(s, lp); ctx.stroke();
    }
  });
}

function texConcreteCool() {
  const rng = seededRng(9441);
  return makeTex((ctx, s) => {
    ctx.fillStyle = '#2a3340';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 420; i++) {
      const x = (rng() * s) | 0;
      const y = (rng() * s) | 0;
      const a = 0.04 + rng() * 0.1;
      const g = 70 + ((rng() * 55) | 0);
      ctx.fillStyle = `rgba(${g},${g + 6},${g + 12},${a.toFixed(3)})`;
      ctx.fillRect(x, y, 1 + ((rng() * 2) | 0), 1 + ((rng() * 2) | 0));
    }
    for (let i = 0; i < 8; i++) {
      const y = (i + 1) * (s / 9);
      ctx.fillStyle = 'rgba(170,195,225,0.045)';
      ctx.fillRect(0, y, s, 1);
    }
  });
}

function texHazardStripeSoft() {
  return makeTex((ctx, s) => {
    ctx.fillStyle = '#1a202a';
    ctx.fillRect(0, 0, s, s);
    ctx.save();
    ctx.translate(s * 0.5, s * 0.5);
    ctx.rotate(-Math.PI / 4);
    ctx.translate(-s * 0.5, -s * 0.5);
    const stripeW = Math.max(16, (s / 9) | 0);
    for (let x = -s; x < s * 2; x += stripeW * 2) {
      ctx.fillStyle = 'rgba(230,164,72,0.42)';
      ctx.fillRect(x, -s, stripeW, s * 3);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(160,190,225,0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, s - 6, s - 6);
  });
}

function makeAtlasTileTexture(image, col, row, cols = 4, rows = 2, repeatX = 1, repeatY = 1, labelTrimRatio = 0.28) {
  const iw = image && image.width ? image.width : 0;
  const ih = image && image.height ? image.height : 0;
  if (!iw || !ih) return null;
  const tw = Math.max(1, Math.floor(iw / cols));
  const th = Math.max(1, Math.floor(ih / rows));
  const sx = Math.max(0, Math.min(iw - tw, Math.floor(col * tw)));
  const sy = Math.max(0, Math.min(ih - th, Math.floor(row * th)));
  // Texture sheet has text labels in the bottom strip: crop them away aggressively.
  const trim = Math.max(0, Math.min(0.45, labelTrimRatio));
  const topPad = Math.floor(th * 0.01);
  const cropH = Math.max(1, Math.floor(th * (1 - trim)) - topPad);
  const c = document.createElement('canvas');
  c.width = tw;
  c.height = cropH;
  const ctx = c.getContext('2d');
  ctx.drawImage(image, sx, sy + topPad, tw, cropH, 0, 0, tw, cropH);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  return t;
}

// ── Sky dome ───────────────────────────────────────────────────────────────────

function makeSkyCanvas(topHex, horizonHex, groundHex) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0,    topHex);
  g.addColorStop(0.40, horizonHex);
  g.addColorStop(0.60, horizonHex);
  g.addColorStop(1,    groundHex);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true;
  return t;
}

function buildSkyDome(topHex, horizonHex, groundHex, starCount = 0, starColor = 0xffffff) {
  const skyMat = new THREE.MeshBasicMaterial({
    map: makeSkyCanvas(topHex, horizonHex, groundHex),
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  sceneAddArena(new THREE.Mesh(new THREE.SphereGeometry(480, 24, 12), skyMat));
  if (starCount > 0) {
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      pos[i * 3]     = 460 * Math.sin(p) * Math.cos(t);
      pos[i * 3 + 1] = 460 * Math.sin(p) * Math.sin(t);
      pos[i * 3 + 2] = 460 * Math.cos(p);
    }
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sceneAddArena(new THREE.Points(sGeo, new THREE.PointsMaterial({
      color: starColor, size: 1.5, sizeAttenuation: true, fog: false,
    })));
  }
}

// ── Shared build helper ────────────────────────────────────────────────────────

function addBox(x, y, z, w, h, d, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  sceneAddArena(mesh);
  arenaObjects.push({ mesh, hw: w / 2, hh: h / 2, hd: d / 2 });
  return mesh;
}

// ── Map 0: Gothic Arena ────────────────────────────────────────────────────────

function buildArena() {
  const tFloor  = texGothicFloor(); tFloor.repeat.set(15, 15);
  const tWall   = texGothicWall();  tWall.repeat.set(20, 4);
  const tPlat   = texMetalPlate();  tPlat.repeat.set(3, 3);
  const tCrateA = texGothicWall();  tCrateA.repeat.set(2, 2);
  const tCrateB = texMetalPlate('#1e2230'); tCrateB.repeat.set(2, 2);
  const tArenaAccent = texHazardStripeSoft(); tArenaAccent.repeat.set(4, 1.2);

  const matFloor  = new THREE.MeshStandardMaterial({ color: 0x8a7868, roughness: 0.88, metalness: 0.05, map: tFloor });
  const matWall   = new THREE.MeshStandardMaterial({ color: 0x9a7858, roughness: 0.82, metalness: 0.1,  map: tWall });
  const matPlat   = new THREE.MeshStandardMaterial({ color: 0x607080, roughness: 0.55, metalness: 0.5,  map: tPlat });
  const matPillar = new THREE.MeshStandardMaterial({ color: 0x907858, roughness: 0.72, metalness: 0.15, map: tWall });
  const matTrim   = new THREE.MeshStandardMaterial({ color: 0xBB9945, roughness: 0.35, metalness: 0.85, emissive: new THREE.Color(0x332808) });
  const matGlow   = new THREE.MeshStandardMaterial({ color: 0xff5500, roughness: 0.3,  metalness: 0.4,  emissive: new THREE.Color(0xff3300) });
  const matTech   = new THREE.MeshStandardMaterial({ color: 0x00cc55, roughness: 0.3,  metalness: 0.7,  emissive: new THREE.Color(0x008833), map: tArenaAccent });
  const matCeil   = new THREE.MeshStandardMaterial({ color: 0x3a2e22, roughness: 0.9,  metalness: 0.1,  map: tWall });
  const matBeam   = new THREE.MeshStandardMaterial({ color: 0x4a4850, roughness: 0.5,  metalness: 0.6,  map: tPlat });
  const matCrateA = new THREE.MeshStandardMaterial({ color: 0x786040, roughness: 0.7,  metalness: 0.2,  map: tCrateA });
  const matCrateB = new THREE.MeshStandardMaterial({ color: 0x505870, roughness: 0.6,  metalness: 0.4,  map: tCrateB });
  const matTorch  = new THREE.MeshStandardMaterial({ color: 0xff7744, emissive: new THREE.Color(0xff5522), roughness: 0.2, metalness: 0.5 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), matFloor);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sceneAddArena(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), matCeil);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 18; sceneAddArena(ceil);

  for (let i = -4; i <= 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 120), matBeam);
    b.position.set(i * 13, 17.6, 0); sceneAddArena(b);
  }

  [[-58, 9, 0, 2, 18, 120], [58, 9, 0, 2, 18, 120],
   [0, 9, -58, 120, 18, 2], [0, 9, 58, 120, 18, 2]].forEach(a => addBox(...a, matWall));

  [[0, 0.15, -57, 80, 0.3, 0.4], [0, 0.15, 57, 80, 0.3, 0.4],
   [-57, 0.15, 0, 0.4, 0.3, 80], [57, 0.15, 0, 0.4, 0.3, 80]].forEach(([x, y, z, w, h, d]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matTrim);
    m.position.set(x, y, z); sceneAddArena(m);
  });

  [[-20, 0.02, 0, 0.35, 0.08, 40], [20, 0.02, 0, 0.35, 0.08, 40],
   [0, 0.02, -20, 40, 0.08, 0.35], [0, 0.02, 20, 40, 0.08, 0.35]].forEach(([x, y, z, w, h, d]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matGlow);
    m.position.set(x, y, z); sceneAddArena(m);
  });

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = Math.cos(a) * 14, pz = Math.sin(a) * 14;
    addBox(px, 3.5, pz, 2, 7, 2, matPillar);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 2.6), matTrim);
    cap.position.set(px, 7.25, pz); sceneAddArena(cap);
  }

  [[0, 4, 0, 18, 1, 18], [-28, 2.5, -28, 12, 1, 12], [28, 2.5, -28, 12, 1, 12],
   [-28, 2.5, 28, 12, 1, 12], [28, 2.5, 28, 12, 1, 12],
   [-42, 5, 0, 8, 1, 20], [42, 5, 0, 8, 1, 20],
   [0, 5, -42, 20, 1, 8], [0, 5, 42, 20, 1, 8]].forEach(a => addBox(...a, matPlat));

  [[9, 4.55, 0, 0.15, 0.08, 18], [-9, 4.55, 0, 0.15, 0.08, 18],
   [0, 4.55, 9, 18, 0.08, 0.15], [0, 4.55, -9, 18, 0.08, 0.15]].forEach(([x, y, z, w, h, d]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matTech);
    m.position.set(x, y, z); sceneAddArena(m);
  });

  [[-18, 1, -18, 5, 2, 5, matCrateA], [18, 1, -18, 5, 2, 5, matCrateB],
   [-18, 1, 18, 5, 2, 5, matCrateB], [18, 1, 18, 5, 2, 5, matCrateA],
   [0, 1, -30, 6, 2, 6, matCrateA], [0, 1, 30, 6, 2, 6, matCrateA],
   [-30, 1, 0, 6, 2, 6, matCrateB], [30, 1, 0, 6, 2, 6, matCrateB]].forEach(([x, y, z, w, h, d, m]) => addBox(x, y, z, w, h, d, m));

  [[-56, 5, -20], [-56, 5, 20], [56, 5, -20], [56, 5, 20],
   [-20, 5, -56], [20, 5, -56], [-20, 5, 56], [20, 5, 56],
   [-56, 5, 0], [56, 5, 0], [0, 5, -56], [0, 5, 56]].forEach(([x, y, z]) => {
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), matTorch);
    t.position.set(x, y, z); sceneAddArena(t);
  });

  buildSkyDome('#080408', '#1a0c06', '#040202', 900, 0xffddaa);
}

function buildLights() {
  sceneAddArena(new THREE.AmbientLight(0x807055, 0.76));
  sceneAddArena(new THREE.HemisphereLight(0x8ca0b8, 0x261c14, 0.52));
  const sun = new THREE.DirectionalLight(0xffc080, 0.92);
  sun.position.set(20, 40, 15); sun.castShadow = true;
  sun.shadow.bias = -0.00028;
  sun.shadow.normalBias = 0.028;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
  sceneAddArena(sun);
  [[-56, 5, -20], [-56, 5, 20], [56, 5, -20], [56, 5, 20],
   [-20, 5, -56], [20, 5, -56], [-20, 5, 56], [20, 5, 56],
   [-56, 5, 0], [56, 5, 0], [0, 5, -56], [0, 5, 56]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xff9944, 3, 45); l.position.set(x, y, z); sceneAddArena(l);
  });
  [[0, 7, 0], [-28, 4.5, -28], [28, 4.5, 28]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0x00dd77, 2, 30); l.position.set(x, y, z); sceneAddArena(l);
  });
  [[0, 0.5, 0], [-20, 0.5, 0], [20, 0.5, 0], [0, 0.5, -20], [0, 0.5, 20]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xff5500, 1.5, 18); l.position.set(x, y, z); sceneAddArena(l);
  });
  [[-40, 8, -40], [40, 8, 40], [-40, 8, 40], [40, 8, -40]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xffaa66, 1.5, 50); l.position.set(x, y, z); sceneAddArena(l);
  });
  // Walkway edge readability (ground-level navigation lines).
  [[-32, 2.2, 0], [32, 2.2, 0], [0, 2.2, -32], [0, 2.2, 32]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xffcc88, 1.25, 30); l.position.set(x, y, z); sceneAddArena(l);
  });
  addRimFillLights();
}

// ── Map 1: DM-Deck16 ──────────────────────────────────────────────────────────

function buildDeck16() {
  const tFloor  = texMetalPlate('#14182a'); tFloor.repeat.set(17, 17);
  const tWall   = texIndustrialWall();      tWall.repeat.set(16, 3);
  const tDeck   = texMetalGrate();          tDeck.repeat.set(6, 3);
  const tBridge = texMetalGrate();          tBridge.repeat.set(12, 1);
  const tBeam   = texMetalPlate('#1c2438'); tBeam.repeat.set(2, 2);
  const tCrate  = texMetalPlate('#20283a'); tCrate.repeat.set(2, 2);
  const tCeil   = texMetalPlate('#080c14'); tCeil.repeat.set(17, 17);
  const tDeckAccent = texHazardStripeSoft(); tDeckAccent.repeat.set(7, 1.2);

  const matMetal  = new THREE.MeshStandardMaterial({ color: 0x404870, roughness: 0.85, metalness: 0.5,  map: tFloor });
  const matSteel  = new THREE.MeshStandardMaterial({ color: 0x506090, roughness: 0.7,  metalness: 0.65, map: tWall });
  const matDeck   = new THREE.MeshStandardMaterial({ color: 0x3a5080, roughness: 0.55, metalness: 0.75, map: tDeck });
  const matBridge = new THREE.MeshStandardMaterial({ color: 0x3a5080, roughness: 0.55, metalness: 0.75, map: tBridge });
  const matCeil   = new THREE.MeshStandardMaterial({ color: 0x181c28, roughness: 0.9,  metalness: 0.1,  map: tCeil });
  const matBeam   = new THREE.MeshStandardMaterial({ color: 0x404e70, roughness: 0.5,  metalness: 0.8,  map: tBeam });
  const matGlow   = new THREE.MeshStandardMaterial({ color: 0x0055ee, emissive: new THREE.Color(0x002277), roughness: 0.15, metalness: 0.9 });
  const matWarn   = new THREE.MeshStandardMaterial({ color: 0xff5500, emissive: new THREE.Color(0xcc3300), roughness: 0.3, metalness: 0.4, map: tDeckAccent });
  const matPipe   = new THREE.MeshStandardMaterial({ color: 0x506080, roughness: 0.5,  metalness: 0.8,  map: tBeam });
  const matCrate  = new THREE.MeshStandardMaterial({ color: 0x405080, roughness: 0.75, metalness: 0.3,  map: tCrate });
  const matTrim   = new THREE.MeshStandardMaterial({ color: 0x4a6090, roughness: 0.3,  metalness: 0.9,  emissive: new THREE.Color(0x1a2a40) });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), matMetal);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sceneAddArena(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), matCeil);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 20; sceneAddArena(ceil);

  [[-50, 10, 0, 2, 20, 80], [50, 10, 0, 2, 20, 80],
   [0, 10, -40, 100, 20, 2], [0, 10, 40, 100, 20, 2]].forEach(a => addBox(...a, matSteel));

  for (let i = -4; i <= 4; i++) {
    const bx = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 100), matBeam);
    bx.position.set(i * 11, 19.5, 0); sceneAddArena(bx);
  }
  for (let i = -3; i <= 3; i++) {
    const bz = new THREE.Mesh(new THREE.BoxGeometry(100, 0.9, 0.5), matBeam);
    bz.position.set(0, 19.5, i * 11); sceneAddArena(bz);
  }

  addBox(0, 4.0, 0, 50, 1, 26, matDeck);
  [[0, 4.56, 13.1, 50, 0.1, 0.15], [0, 4.56, -13.1, 50, 0.1, 0.15],
   [25.1, 4.56, 0, 0.15, 0.1, 26], [-25.1, 4.56, 0, 0.15, 0.1, 26]].forEach(([x,y,z,w,h,d]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matGlow);
    m.position.set(x, y, z); sceneAddArena(m);
  });
  [[-20, 2.0, -10], [-20, 2.0, 10], [20, 2.0, -10], [20, 2.0, 10],
   [0, 2.0, -10], [0, 2.0, 10]].forEach(([x, y, z]) => addBox(x, y, z, 1.5, 4, 1.5, matBeam));

  addBox(0, 0.8, -16, 28, 1, 5, matSteel); addBox(0, 2.3, -19, 28, 1, 5, matSteel);
  addBox(0, 0.8, 16,  28, 1, 5, matSteel); addBox(0, 2.3, 19,  28, 1, 5, matSteel);
  addBox(-28, 0.8, 0, 4, 1, 20, matSteel); addBox(-30, 2.3, 0, 4, 1, 20, matSteel);
  addBox(28,  0.8, 0, 4, 1, 20, matSteel); addBox(30,  2.3, 0, 4, 1, 20, matSteel);

  addBox(0, 5.5, 0, 100, 1, 8, matBridge);
  [[0, 6.15, 4.1, 100, 0.3, 0.3], [0, 6.15, -4.1, 100, 0.3, 0.3]].forEach(a => addBox(...a, matTrim));
  [[-35, 2.75, 0], [0, 2.75, 0], [35, 2.75, 0]].forEach(([x, y, z]) => addBox(x, y, z, 1.8, 4.5, 7.5, matBeam));

  [[47, 1.5, -22, 6, 3, 14], [47, 1.5, 22, 6, 3, 14],
   [-47, 1.5, -22, 6, 3, 14], [-47, 1.5, 22, 6, 3, 14]].forEach(a => addBox(...a, matSteel));

  [[38, 3, -30, 8, 6, 10], [-38, 3, -30, 8, 6, 10],
   [38, 3, 30, 8, 6, 10],  [-38, 3, 30, 8, 6, 10]].forEach(a => addBox(...a, matPipe));

  [[34, 6.2, -25], [-34, 6.2, -25], [34, 6.2, 25], [-34, 6.2, 25]].forEach(([x, y, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.8, 0.15), matGlow);
    m.position.set(x, y, z); sceneAddArena(m);
  });

  [[-10, 5.0, -7, 4, 2, 4], [10, 5.0, -7, 4, 2, 4],
   [-10, 5.0,  7, 4, 2, 4], [10, 5.0,  7, 4, 2, 4],
   [0, 5.0, 0, 5, 2, 5]].forEach(a => addBox(...a, matCrate));
  [[-15, 1.5, 0, 5, 3, 5], [15, 1.5, 0, 5, 3, 5],
   [0, 1.0, -25, 10, 2, 5], [0, 1.0, 25, 10, 2, 5]].forEach(a => addBox(...a, matCrate));

  [[-49, 3, -20], [-49, 3, 20], [49, 3, -20], [49, 3, 20],
   [-20, 3, -39], [20, 3, -39], [-20, 3, 39], [20, 3, 39]].forEach(([x, y, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 1.4), matWarn);
    m.position.set(x, y, z); sceneAddArena(m);
  });

  [[-30, 18, 0, 0.5, 0.5, 80], [30, 18, 0, 0.5, 0.5, 80],
   [0, 18, -28, 100, 0.5, 0.5], [0, 18, 28, 100, 0.5, 0.5]].forEach(([x,y,z,w,h,d]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matPipe);
    p.position.set(x, y, z); sceneAddArena(p);
  });

  // Optional atlas pass for custom DM-Deck16 texture sheets.
  // Expected layout: 4 columns x 2 rows. Labels are aggressively cropped out.
  const atlasLoader = new THREE.TextureLoader();
  const deckAtlasCandidates = [
    'assets/dm-deck16-texture-sheet.png',
    'assets/dm-deck16-textures.png',
    'assets/dm-deck16-atlas.png',
    'assets/dm-deck16-sheet.png',
    'assets/deck16-texture-sheet.png',
  ];
  const tryLoadDeckAtlas = (idx = 0) => {
    if (idx >= deckAtlasCandidates.length) return;
    atlasLoader.load(
      deckAtlasCandidates[idx],
      imageTex => {
        const img = imageTex.image;
        const tx0 = makeAtlasTileTexture(img, 0, 0, 4, 2, 17, 17, 0.34);
        const tx1 = makeAtlasTileTexture(img, 1, 0, 4, 2, 16, 3, 0.34);
        const tx2 = makeAtlasTileTexture(img, 2, 0, 4, 2, 6, 3, 0.34);
        const tx3 = makeAtlasTileTexture(img, 3, 0, 4, 2, 12, 1, 0.34);
        const tx4 = makeAtlasTileTexture(img, 0, 1, 4, 2, 7, 1.2, 0.34);
        const tx5 = makeAtlasTileTexture(img, 1, 1, 4, 2, 1, 1, 0.34);
        const tx6 = makeAtlasTileTexture(img, 2, 1, 4, 2, 3, 2, 0.34);
        const tx7 = makeAtlasTileTexture(img, 3, 1, 4, 2, 2, 2, 0.34);

        // Smart role mapping for Deck16 geometry.
        if (tx0) { matMetal.map = tx0; matMetal.needsUpdate = true; }
        if (tx1) { matSteel.map = tx1; matSteel.needsUpdate = true; }
        if (tx2) { matDeck.map = tx2; matDeck.needsUpdate = true; }
        if (tx3) { matBridge.map = tx3; matBridge.needsUpdate = true; }
        if (tx4) { matWarn.map = tx4; matWarn.needsUpdate = true; }
        if (tx5) {
          matGlow.map = tx5;
          matGlow.emissive = new THREE.Color(0x1f7d69);
          matGlow.emissiveIntensity = 0.82;
          matGlow.needsUpdate = true;
        }
        if (tx6) {
          matTrim.map = tx6;
          matTrim.emissive = new THREE.Color(0x6f3d18);
          matTrim.emissiveIntensity = 0.52;
          matTrim.needsUpdate = true;
        }
        if (tx7) { matCrate.map = tx7; matCrate.needsUpdate = true; }

        // Apply stronger sheet look to beams/pipes/ceiling too.
        if (tx1) { matBeam.map = tx1; matBeam.needsUpdate = true; }
        if (tx3) { matPipe.map = tx3; matPipe.needsUpdate = true; }
        if (tx0) { matCeil.map = tx0; matCeil.needsUpdate = true; }
      },
      undefined,
      () => tryLoadDeckAtlas(idx + 1)
    );
  };
  tryLoadDeckAtlas();

  buildSkyDome('#04080e', '#080c1a', '#030508', 0);
}

function buildDeck16Lights() {
  sceneAddArena(new THREE.AmbientLight(0x3a4a70, 1.0));
  const sun = new THREE.DirectionalLight(0xaabbee, 0.98);
  sun.position.set(12, 34, 14); sun.castShadow = true;
  sun.shadow.bias = -0.00028;
  sun.shadow.normalBias = 0.028;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
  sceneAddArena(sun);
  const fill = new THREE.HemisphereLight(0x7090c8, 0x182028, 0.52);
  sceneAddArena(fill);

  [[-49, 4, -20], [-49, 4, 20], [49, 4, -20], [49, 4, 20],
   [-20, 4, -39], [20, 4, -39], [-20, 4, 39], [20, 4, 39]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0x4488ff, 3.2, 48); l.position.set(x, y, z); sceneAddArena(l);
  });
  [[38, 6, -30], [-38, 6, -30], [38, 6, 30], [-38, 6, 30]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xff6622, 3.0, 38); l.position.set(x, y, z); sceneAddArena(l);
  });
  [[0, 7, 0], [-15, 7, 0], [15, 7, 0], [0, 7, -10], [0, 7, 10]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0x66aaff, 2.8, 42); l.position.set(x, y, z); sceneAddArena(l);
  });
  [[-35, 6, 0], [0, 6, 0], [35, 6, 0]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0x22ccff, 2.4, 34); l.position.set(x, y, z); sceneAddArena(l);
  });
  [[-40, 6, -30], [40, 6, -30], [-40, 6, 30], [40, 6, 30]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0x556688, 2.2, 68); l.position.set(x, y, z); sceneAddArena(l);
  });

  // Floor + fill lights: brighten dark corners
  [[-42, 3.2, -28], [42, 3.2, -28], [-42, 3.2, 28], [42, 3.2, 28],
   [0, 3.2, -32], [0, 3.2, 32], [-32, 3.2, 0], [32, 3.2, 0]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0x99bbee, 2.0, 52); l.position.set(x, y, z); sceneAddArena(l);
  });
  // Central deck & side corridors
  [[-18, 4.8, 0], [18, 4.8, 0], [0, 4.8, -12], [0, 4.8, 12],
   [-28, 3.5, -16], [28, 3.5, -16], [-28, 3.5, 16], [28, 3.5, 16]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0x77aaff, 2.2, 36); l.position.set(x, y, z); sceneAddArena(l);
  });
  // Bridge & mid height
  [[-22, 6.8, 0], [22, 6.8, 0], [0, 6.8, -8], [0, 6.8, 8],
   [-10, 6.5, -12], [10, 6.5, -12], [-10, 6.5, 12], [10, 6.5, 12]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xaaccff, 1.9, 40); l.position.set(x, y, z); sceneAddArena(l);
  });
  // Under-bridge utility lights: brighten lower routes naturally.
  [[-26, 3.2, 0], [0, 3.2, 0], [26, 3.2, 0], [0, 3.2, -18], [0, 3.2, 18]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0x88baff, 1.7, 34); l.position.set(x, y, z); sceneAddArena(l);
  });
  addRimFillLights();
}

// ── Map 2: DM-Morpheus ────────────────────────────────────────────────────────

function buildMorpheus() {
  buildSkyDome('#000008', '#060214', '#000006', 2000, 0xccbbff);

  const tMarble = texWhiteMarble(); tMarble.repeat.set(8, 8);
  const tColMat = texMetalPlate('#18202e'); tColMat.repeat.set(2, 4);
  const tMorpheusAccent = texMetalPlate('#16285e'); tMorpheusAccent.repeat.set(3, 3);

  const matPlat = new THREE.MeshStandardMaterial({ color: 0xd8dce8, roughness: 0.65, metalness: 0.15, map: tMarble });
  const matGlow = new THREE.MeshStandardMaterial({ color: 0x4466ff, emissive: new THREE.Color(0x2244ee), roughness: 0.1, metalness: 1.0 });
  const matTrim = new THREE.MeshStandardMaterial({ color: 0x3355cc, emissive: new THREE.Color(0x1133aa), roughness: 0.2, metalness: 0.9, map: tMorpheusAccent });
  const matCol  = new THREE.MeshStandardMaterial({ color: 0x303850, roughness: 0.5, metalness: 0.75, map: tColMat });

  function platTrim(cx, ty, cz, hw, hd) {
    for (const [x, y, z, w, h, d] of [
      [cx,      ty + 0.06, cz + hd, hw * 2, 0.1, 0.22],
      [cx,      ty + 0.06, cz - hd, hw * 2, 0.1, 0.22],
      [cx + hw, ty + 0.06, cz,      0.22,   0.1, hd * 2],
      [cx - hw, ty + 0.06, cz,      0.22,   0.1, hd * 2],
    ]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matGlow);
      m.position.set(x, y, z); sceneAddArena(m);
    }
  }

  addBox(0, -0.5, 0, 36, 1, 36, matPlat);
  platTrim(0, 0, 0, 18, 18);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.1, 16), matGlow);
  core.position.set(0, 0.05, 0); sceneAddArena(core);
  for (const [cx, cz] of [[-13, -13], [13, -13], [-13, 13], [13, 13]])
    addBox(cx, -18, cz, 2, 34, 2, matCol);

  for (const [cx, cz] of [[14, 14], [-14, -14], [14, -14], [-14, 14]]) {
    addBox(cx, 1, cz, 6, 1, 6, matPlat);
    platTrim(cx, 1.5, cz, 3, 3);
    addBox(cx, -8, cz, 1.2, 18, 1.2, matCol);
  }

  for (const [cx, cz] of [[22, 22], [-22, -22], [22, -22], [-22, 22]]) {
    addBox(cx, 2.5, cz, 14, 1, 14, matPlat);
    platTrim(cx, 3, cz, 7, 7);
    addBox(cx, -10, cz, 2, 26, 2, matCol);
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 4, 8), matTrim);
    pil.position.set(cx, 5, cz); sceneAddArena(pil);
  }

  for (const [cx, cz] of [[34, 0], [-34, 0], [0, 30], [0, -30]]) {
    addBox(cx, 5, cz, 10, 1, 10, matPlat);
    platTrim(cx, 5.5, cz, 5, 5);
    addBox(cx, -14, cz, 1.5, 38, 1.5, matCol);
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 5, 8), matTrim);
    pil.position.set(cx, 8, cz); sceneAddArena(pil);
  }

  for (const [cx, cz] of [[28, 28], [-28, -28], [28, -28], [-28, 28]]) {
    addBox(cx, 8.5, cz, 7, 1, 7, matPlat);
    platTrim(cx, 9, cz, 3.5, 3.5);
    addBox(cx, -16, cz, 1.5, 50, 1.5, matCol);
    addBox(cx, 12.5, cz, 2.2, 6, 2.2, matTrim);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 8), matGlow);
    cap.position.set(cx, 16.5, cz); sceneAddArena(cap);
  }

  // Optional atlas pass for custom DM-Morpheus texture sheets.
  // Expected layout: 4x2 sheet. makeAtlasTileTexture() trims label text away.
  const atlasLoader = new THREE.TextureLoader();
  const morpheusAtlasCandidates = [
    'assets/dm-morpheus-texture-sheet.png',
    'assets/dm-morpheus-textures.png',
    'assets/dm-morpheus-atlas.png',
    'assets/dm-morpheus-sheet.png',
    'assets/morpheus-texture-sheet.png',
  ];
  const tryLoadMorpheusAtlas = (idx = 0) => {
    if (idx >= morpheusAtlasCandidates.length) return;
    atlasLoader.load(
      morpheusAtlasCandidates[idx],
      imageTex => {
        const img = imageTex.image;
        const tx0 = makeAtlasTileTexture(img, 0, 0, 4, 2, 8, 8, 0.34);
        const tx1 = makeAtlasTileTexture(img, 1, 0, 4, 2, 3, 4, 0.34);
        const tx2 = makeAtlasTileTexture(img, 2, 0, 4, 2, 3, 2, 0.34);
        const tx3 = makeAtlasTileTexture(img, 3, 0, 4, 2, 2, 4, 0.34);
        const tx4 = makeAtlasTileTexture(img, 0, 1, 4, 2, 3, 1, 0.34);
        const tx5 = makeAtlasTileTexture(img, 1, 1, 4, 2, 1, 1, 0.34);
        const tx6 = makeAtlasTileTexture(img, 2, 1, 4, 2, 3, 2, 0.34);
        const tx7 = makeAtlasTileTexture(img, 3, 1, 4, 2, 2, 2, 0.34);

        // Smart role mapping for Morpheus platform architecture.
        if (tx0) { matPlat.map = tx0; matPlat.needsUpdate = true; }
        if (tx1) { matCol.map = tx1; matCol.needsUpdate = true; }
        if (tx2) {
          matTrim.map = tx2;
          matTrim.needsUpdate = true;
        }
        if (tx3) {
          matGlow.map = tx3;
          matGlow.needsUpdate = true;
        }
        if (tx4) {
          matGlow.map = tx4;
          matGlow.emissive = new THREE.Color(0x1d2e72);
          matGlow.emissiveIntensity = 0.78;
          matGlow.needsUpdate = true;
        }
        if (tx5) {
          matTrim.map = tx5;
          matTrim.emissive = new THREE.Color(0x1f6f79);
          matTrim.emissiveIntensity = 0.44;
          matTrim.needsUpdate = true;
        }
        if (tx6) {
          const accentMat = new THREE.MeshStandardMaterial({
            color: 0xd6a55c,
            roughness: 0.24,
            metalness: 0.7,
            map: tx6,
            emissive: new THREE.Color(0x6a3b18),
            emissiveIntensity: 0.54,
          });
          for (const [cx, cz] of [[14, 14], [-14, -14], [14, -14], [-14, 14]]) {
            const a = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.22, 12), accentMat);
            a.position.set(cx, 1.66, cz);
            sceneAddArena(a);
          }
        }
        if (tx7) {
          const crateMat = new THREE.MeshStandardMaterial({ color: 0xab8a67, roughness: 0.78, metalness: 0.08, map: tx7 });
          [[34, 5.8, 0], [-34, 5.8, 0], [0, 5.8, 30], [0, 5.8, -30]].forEach(([x, y, z]) => {
            addBox(x, y, z, 2.4, 1.2, 2.4, crateMat);
          });
        }
      },
      undefined,
      () => tryLoadMorpheusAtlas(idx + 1)
    );
  };
  tryLoadMorpheusAtlas();
}

function buildMorpheusLights() {
  sceneAddArena(new THREE.AmbientLight(0x1a1a3a, 0.86));
  sceneAddArena(new THREE.HemisphereLight(0x7098d8, 0x101018, 0.46));
  const sun = new THREE.DirectionalLight(0xaabbff, 0.84);
  sun.position.set(30, 60, 20); sun.castShadow = true;
  sun.shadow.bias = -0.00028;
  sun.shadow.normalBias = 0.028;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 250;
  sun.shadow.camera.left = -80; sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;   sun.shadow.camera.bottom = -80;
  sceneAddArena(sun);
  [[0, 2, 0], [22, 5, 22], [-22, 5, -22], [22, 5, -22], [-22, 5, 22]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0x4466ff, 3.15, 45); l.position.set(x, y, z); sceneAddArena(l);
  });
  [[34, 7, 0], [-34, 7, 0], [0, 7, 30], [0, 7, -30]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0x3355ff, 2.75, 38); l.position.set(x, y, z); sceneAddArena(l);
  });
  [[28, 11, 28], [-28, 11, -28], [28, 11, -28], [-28, 11, 28]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0x5577ff, 2.75, 30); l.position.set(x, y, z); sceneAddArena(l);
  });
  const coreLight = new THREE.PointLight(0x6699ff, 3.6, 30);
  coreLight.position.set(0, 3, 0); sceneAddArena(coreLight);
  // Vertical landmark lighting for high platforms.
  [[34, 10, 0], [-34, 10, 0], [0, 10, 30], [0, 10, -30]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0x88a8ff, 1.7, 34); l.position.set(x, y, z); sceneAddArena(l);
  });
  addRimFillLights();
}

// ── Map 3: DM-Phobos (moon base — gray/orange, multi-level) ─────────────────

function buildPhobos() {
  const tMoon = texMetalPlate('#383c48'); tMoon.repeat.set(18, 18);
  const tWall = texIndustrialWall(); tWall.repeat.set(14, 3);
  const tGrate = texMetalGrate(); tGrate.repeat.set(5, 4);
  const tPhobosAccent = texHazardStripeSoft(); tPhobosAccent.repeat.set(6, 1.2);

  const matMoon  = new THREE.MeshStandardMaterial({ color: 0x7a8290, roughness: 0.82, metalness: 0.24, map: tMoon });
  const matWall  = new THREE.MeshStandardMaterial({ color: 0x5a6474, roughness: 0.72, metalness: 0.38, map: tWall });
  const matGrate = new THREE.MeshStandardMaterial({ color: 0x606878, roughness: 0.58, metalness: 0.48, map: tGrate });
  const matDark  = new THREE.MeshStandardMaterial({ color: 0x444c5c, roughness: 0.76, metalness: 0.42, map: tMoon });
  const matHaz   = new THREE.MeshStandardMaterial({ color: 0xff7722, emissive: new THREE.Color(0x883310), roughness: 0.3, metalness: 0.48, map: tPhobosAccent });
  const matGlow  = new THREE.MeshStandardMaterial({ color: 0xffbb55, emissive: new THREE.Color(0x663318), roughness: 0.26, metalness: 0.52 });
  const matTrim  = new THREE.MeshStandardMaterial({ color: 0x687080, roughness: 0.5, metalness: 0.6, map: tGrate });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(128, 128), matMoon);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sceneAddArena(floor);

  // Open-roof variant: keep Phobos exposed to the sky dome.

  [[-54, 11, 0, 3, 22, 122], [54, 11, 0, 3, 22, 122],
   [0, 11, -54, 122, 22, 3], [0, 11, 54, 122, 22, 3]].forEach(a => addBox(...a, matWall));

  // Large corner platforms (classic open center)
  [[-36, 2.2, -36], [36, 2.2, -36], [-36, 2.2, 36], [36, 2.2, 36]].forEach(([x, y, z]) => {
    addBox(x, y, z, 22, 1, 22, matGrate);
  });

  // Mid plateau + orange trim
  addBox(0, 4.8, 0, 36, 1, 36, matDark);
  [[0, 5.36, 18.1, 36, 0.12, 0.9], [0, 5.36, -18.1, 36, 0.12, 0.9],
   [18.1, 5.36, 0, 0.9, 0.12, 36], [-18.1, 5.36, 0, 0.9, 0.12, 36]].forEach(([x, y, z, w, h, d]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matHaz);
    m.position.set(x, y, z); sceneAddArena(m);
  });

  // Connector bridges to center
  addBox(0, 2.2, 0, 14, 1, 52, matTrim);
  addBox(0, 2.2, 0, 52, 1, 14, matTrim);

  // Corner pillars
  for (const [cx, cz] of [[-48, -48], [48, -48], [-48, 48], [48, 48]]) {
    addBox(cx, 4, cz, 5, 8, 5, matWall);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.35, 5.4), matGlow);
    cap.position.set(cx, 8.2, cz); sceneAddArena(cap);
  }

  // Sides: low decks
  [[-44, 1.1, 0], [44, 1.1, 0], [0, 1.1, -44], [0, 1.1, 44]].forEach(([x, y, z]) => {
    addBox(x, y, z, 16, 1, 10, matGrate);
  });

  // Warning beacons along wall
  [[-52, 2.5, -25], [-52, 2.5, 25], [52, 2.5, -25], [52, 2.5, 25],
   [-25, 2.5, -52], [25, 2.5, -52], [-25, 2.5, 52], [25, 2.5, 52]].forEach(([x, y, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.9), matHaz);
    m.position.set(x, y, z); sceneAddArena(m);
  });

  // Optional atlas pass for custom DM-Phobos texture sheets.
  // Expected layout: 4x2. Labels are cropped away by makeAtlasTileTexture().
  const atlasLoader = new THREE.TextureLoader();
  const phobosAtlasCandidates = [
    'assets/dm-phobos-texture-sheet.png',
    'assets/dm-phobos-textures.png',
    'assets/dm-phobos-atlas.png',
    'assets/dm-phobos-sheet.png',
    'assets/phobos-texture-sheet.png',
  ];
  const tryLoadPhobosAtlas = (idx = 0) => {
    if (idx >= phobosAtlasCandidates.length) return;
    atlasLoader.load(
      phobosAtlasCandidates[idx],
      imageTex => {
        const img = imageTex.image;
        const tx0 = makeAtlasTileTexture(img, 0, 0, 4, 2, 18, 18, 0.34);
        const tx1 = makeAtlasTileTexture(img, 1, 0, 4, 2, 14, 3, 0.34);
        const tx2 = makeAtlasTileTexture(img, 2, 0, 4, 2, 5, 4, 0.34);
        const tx3 = makeAtlasTileTexture(img, 3, 0, 4, 2, 6, 2, 0.34);
        const tx4 = makeAtlasTileTexture(img, 0, 1, 4, 2, 6, 1.2, 0.34);
        const tx5 = makeAtlasTileTexture(img, 1, 1, 4, 2, 1, 1, 0.34);
        const tx6 = makeAtlasTileTexture(img, 2, 1, 4, 2, 3, 2, 0.34);
        const tx7 = makeAtlasTileTexture(img, 3, 1, 4, 2, 2, 2, 0.34);

        // Smart mapping for Phobos' moon-base materials.
        if (tx0) { matMoon.map = tx0; matMoon.needsUpdate = true; }
        if (tx1) { matWall.map = tx1; matWall.needsUpdate = true; }
        if (tx2) { matGrate.map = tx2; matGrate.needsUpdate = true; }
        if (tx3) { matDark.map = tx3; matDark.needsUpdate = true; }
        if (tx4) { matHaz.map = tx4; matHaz.needsUpdate = true; }
        if (tx5) {
          matGlow.map = tx5;
          matGlow.emissive = new THREE.Color(0x1f8c74);
          matGlow.emissiveIntensity = 0.76;
          matGlow.needsUpdate = true;
        }
        if (tx6) {
          matHaz.map = tx6;
          matHaz.emissive = new THREE.Color(0x7a4518);
          matHaz.emissiveIntensity = 0.58;
          matHaz.needsUpdate = true;
        }
        if (tx7) {
          const crateMat = new THREE.MeshStandardMaterial({ color: 0xaa8968, roughness: 0.78, metalness: 0.08, map: tx7 });
          [[-44, 1.8, 0], [44, 1.8, 0], [0, 1.8, -44], [0, 1.8, 44]].forEach(([x, y, z]) => {
            addBox(x, y, z, 6.5, 1.4, 4.5, crateMat);
          });
        }
      },
      undefined,
      () => tryLoadPhobosAtlas(idx + 1)
    );
  };
  tryLoadPhobosAtlas();

  // Alien-planet sky: teal-violet horizon with dense bright stars.
  buildSkyDome('#3a2e64', '#3f9a88', '#1a1f2a', 3200, 0xd8f6ff);
}

function buildPhobosLights() {
  sceneAddArena(new THREE.AmbientLight(0x8090a8, 1.08));
  const sun = new THREE.DirectionalLight(0xe8f0ff, 1.04);
  sun.position.set(-22, 48, 24); sun.castShadow = true;
  sun.shadow.bias = -0.00028;
  sun.shadow.normalBias = 0.028;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 220;
  sun.shadow.camera.left = -75; sun.shadow.camera.right = 75;
  sun.shadow.camera.top = 75; sun.shadow.camera.bottom = -75;
  sceneAddArena(sun);
  const fill = new THREE.HemisphereLight(0xa8b8d8, 0x3a4858, 0.58);
  sceneAddArena(fill);

  [[0, 6, 0], [-36, 4, -36], [36, 4, -36], [-36, 4, 36], [36, 4, 36]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xffaa66, 3.8, 58); l.position.set(x, y, z); sceneAddArena(l);
  });
  [[-44, 3, 0], [44, 3, 0], [0, 3, -44], [0, 3, 44]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0x88aacc, 3.2, 52); l.position.set(x, y, z); sceneAddArena(l);
  });
  [[-52, 4, 0], [52, 4, 0], [0, 4, -52], [0, 4, 52]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xff8844, 2.8, 55); l.position.set(x, y, z); sceneAddArena(l);
  });
  [[-28, 2.5, -28], [28, 2.5, -28], [-28, 2.5, 28], [28, 2.5, 28],
   [0, 1.8, 0], [-20, 1.5, 0], [20, 1.5, 0], [0, 1.5, -20], [0, 1.5, 20]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xb0c4e8, 2.4, 72); l.position.set(x, y, z); sceneAddArena(l);
  });
  // Corner deck uplights for silhouette separation.
  [[-36, 2.6, -36], [36, 2.6, -36], [-36, 2.6, 36], [36, 2.6, 36]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xe6c090, 1.5, 30); l.position.set(x, y, z); sceneAddArena(l);
  });
  addRimFillLights();
}

// ── Map 4: DM-Codex (simplified bot-friendly layout) ──────────────────────────

function buildCodex() {
  const tFloor = texGothicFloor(); tFloor.repeat.set(16, 16);
  const tWall = texGothicWall(); tWall.repeat.set(16, 4);
  const tMetal = texMetalPlate('#1f2a3a'); tMetal.repeat.set(5, 5);
  const tGrate = texMetalGrate(); tGrate.repeat.set(8, 2);
  const tConcrete = texConcreteCool(); tConcrete.repeat.set(10, 3);
  const tHazard = texHazardStripeSoft(); tHazard.repeat.set(8, 1);

  const matFloor = new THREE.MeshStandardMaterial({ color: 0x786452, roughness: 0.86, metalness: 0.08, map: tFloor });
  const matWall = new THREE.MeshStandardMaterial({ color: 0x7e6954, roughness: 0.82, metalness: 0.1, map: tWall });
  const matMetal = new THREE.MeshStandardMaterial({ color: 0x455772, roughness: 0.58, metalness: 0.62, map: tMetal });
  const matBridge = new THREE.MeshStandardMaterial({ color: 0x3b5678, roughness: 0.5, metalness: 0.72, map: tGrate });
  const matLava = new THREE.MeshStandardMaterial({ color: 0xff6f24, emissive: new THREE.Color(0xcc3f10), roughness: 0.24, metalness: 0.2 });
  const matTrim = new THREE.MeshStandardMaterial({ color: 0xba9758, roughness: 0.34, metalness: 0.82, emissive: new THREE.Color(0x2a1e08) });
  const matConcrete = new THREE.MeshStandardMaterial({ color: 0x5b6778, roughness: 0.76, metalness: 0.22, map: tConcrete });
  const matHazard = new THREE.MeshStandardMaterial({ color: 0xa99572, roughness: 0.5, metalness: 0.3, map: tHazard });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(132, 132), matFloor);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sceneAddArena(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(132, 132), matWall);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 18; sceneAddArena(ceil);

  [[-61, 9, 0, 2, 18, 122], [61, 9, 0, 2, 18, 122], [0, 9, -61, 122, 18, 2], [0, 9, 61, 122, 18, 2]]
    .forEach(a => addBox(...a, matWall));

  // Central lava strip with wide, easy bridge crossing.
  addBox(16, 0.3, 0, 46, 0.6, 34, matLava);
  addBox(4, 3.2, 0, 30, 1, 8, matBridge);
  [[4, 3.8, 4.1, 30, 0.1, 0.2], [4, 3.8, -4.1, 30, 0.1, 0.2]].forEach(([x, y, z, w, h, d]) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matTrim);
    r.position.set(x, y, z); sceneAddArena(r);
  });

  // West side: simple stairs area.
  addBox(-40, 1.1, -26, 20, 1, 18, matMetal);
  addBox(-30, 2.1, -16, 16, 1, 14, matMetal);
  addBox(-20, 3.1, -6, 12, 1, 10, matMetal);

  // West north lift room approximation (static ledges, no hard jumps).
  addBox(-44, 1.1, 40, 16, 1, 16, matMetal);
  addBox(-44, 3.0, 40, 10, 1, 10, matMetal);
  addBox(-44, 4.9, 40, 12, 1, 12, matMetal);

  // East chamber: broad stepped tiers.
  addBox(42, 1.1, 20, 20, 1, 18, matMetal);
  addBox(46, 2.6, 10, 16, 1, 14, matMetal);
  addBox(50, 4.1, 0, 12, 1, 10, matMetal);
  addBox(42, 1.1, -20, 20, 1, 18, matMetal);

  // Connector lanes to keep bots moving around map ring.
  addBox(-14, 1.1, 24, 16, 1, 10, matMetal);
  addBox(2, 1.1, 24, 16, 1, 10, matMetal);
  addBox(20, 1.1, 24, 16, 1, 10, matMetal);
  addBox(-14, 1.1, -24, 16, 1, 10, matMetal);
  addBox(2, 1.1, -24, 16, 1, 10, matMetal);
  addBox(20, 1.1, -24, 16, 1, 10, matMetal);

  // Subtle texture accents for navigation readability.
  addBox(-14, 0.56, 24, 16, 0.12, 10, matHazard);
  addBox(20, 0.56, -24, 16, 0.12, 10, matHazard);
  addBox(-44, 1.55, 47.2, 16, 0.12, 1.6, matConcrete);
  addBox(50, 4.55, 5.6, 12, 0.12, 1.6, matConcrete);

  // Mild cover only (avoid bot traps).
  [[-24, 1.6, 10, 4, 3.2, 4], [-24, 1.6, -10, 4, 3.2, 4], [10, 1.6, 12, 4, 3.2, 4], [10, 1.6, -12, 4, 3.2, 4]]
    .forEach(a => addBox(...a, matWall));

  // Optional atlas pass for custom DM-Codex texture sheets.
  // Expected layout: 4 columns x 2 rows, labels stripped by makeAtlasTileTexture().
  const atlasLoader = new THREE.TextureLoader();
  const codexAtlasCandidates = [
    'assets/dm-codex-texture-sheet.png',
    'assets/dm-codex-textures.png',
    'assets/dm-codex-atlas.png',
    'assets/dm-codex-sheet.png',
  ];
  const tryLoadCodexAtlas = (idx = 0) => {
    if (idx >= codexAtlasCandidates.length) return;
    atlasLoader.load(
      codexAtlasCandidates[idx],
      imageTex => {
        const img = imageTex.image;
        const tx0 = makeAtlasTileTexture(img, 0, 0, 4, 2, 12, 12, 0.34);
        const tx1 = makeAtlasTileTexture(img, 1, 0, 4, 2, 16, 4, 0.34);
        const tx2 = makeAtlasTileTexture(img, 2, 0, 4, 2, 5, 5, 0.34);
        const tx3 = makeAtlasTileTexture(img, 3, 0, 4, 2, 8, 2, 0.34);
        const tx4 = makeAtlasTileTexture(img, 0, 1, 4, 2, 8, 1, 0.34);
        const tx5 = makeAtlasTileTexture(img, 1, 1, 4, 2, 1, 1, 0.34);
        const tx6 = makeAtlasTileTexture(img, 2, 1, 4, 2, 3, 2, 0.34);
        const tx7 = makeAtlasTileTexture(img, 3, 1, 4, 2, 2, 2, 0.34);

        // Smart material mapping by role, not by hardcoded visual assumption.
        if (tx0) { matFloor.map = tx0; matFloor.needsUpdate = true; }
        if (tx1) { matWall.map = tx1; matWall.needsUpdate = true; }
        if (tx2) { matMetal.map = tx2; matMetal.needsUpdate = true; }
        if (tx3) { matBridge.map = tx3; matBridge.needsUpdate = true; }
        if (tx4) { matHazard.map = tx4; matHazard.needsUpdate = true; }
        if (tx5) {
          matTrim.map = tx5;
          matTrim.emissive = new THREE.Color(0x2e2a14);
          matTrim.emissiveIntensity = 0.24;
          matTrim.needsUpdate = true;
        }
        if (tx6) {
          const accentMat = new THREE.MeshStandardMaterial({
            color: 0xe1af62,
            roughness: 0.26,
            metalness: 0.55,
            map: tx6,
            emissive: new THREE.Color(0x784018),
            emissiveIntensity: 0.56,
          });
          [[4, 3.92, 4.1, 30, 0.06, 0.18], [4, 3.92, -4.1, 30, 0.06, 0.18]].forEach(([x, y, z, w, h, d]) => {
            const a = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), accentMat);
            a.position.set(x, y, z);
            sceneAddArena(a);
          });
        }
        if (tx7) {
          const coverMat = new THREE.MeshStandardMaterial({ color: 0xa08462, roughness: 0.78, metalness: 0.08, map: tx7 });
          [[-24, 1.6, 10, 3.6, 3.0, 3.6], [10, 1.6, -12, 3.6, 3.0, 3.6]].forEach(a => addBox(...a, coverMat));
        }
      },
      undefined,
      () => tryLoadCodexAtlas(idx + 1)
    );
  };
  tryLoadCodexAtlas();

  buildSkyDome('#0a0607', '#1d110c', '#070405', 900, 0xffd2a4);
}

function buildCodexLights() {
  sceneAddArena(new THREE.AmbientLight(0x7c6854, 0.92));
  sceneAddArena(new THREE.HemisphereLight(0xae9b88, 0x2a1a12, 0.5));
  const sun = new THREE.DirectionalLight(0xffc48f, 0.92);
  sun.position.set(20, 40, 10); sun.castShadow = true;
  sun.shadow.bias = -0.00028;
  sun.shadow.normalBias = 0.028;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 210;
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
  sceneAddArena(sun);

  [[16, 2, 0], [8, 2, 0], [24, 2, 0], [16, 2, -10], [16, 2, 10]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xff6622, 2.7, 32); l.position.set(x, y, z); sceneAddArena(l);
  });
  [[-44, 5.3, 40], [-30, 3.0, -16], [50, 4.5, 0], [46, 3.0, 10], [42, 2.0, -20]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0x88b8ff, 1.9, 38); l.position.set(x, y, z); sceneAddArena(l);
  });
  // Lane guidance around ring connectors.
  [[-14, 2.1, 24], [2, 2.1, 24], [20, 2.1, 24], [-14, 2.1, -24], [2, 2.1, -24], [20, 2.1, -24]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xd8b48c, 1.2, 22); l.position.set(x, y, z); sceneAddArena(l);
  });
  addRimFillLights();
}

// ── Map 5: DM-Factory (original industrial layout) ────────────────────────────

function buildFactory() {
  const tFloor = texConcreteCool(); tFloor.repeat.set(15, 12);
  const tWall = texIndustrialWall(); tWall.repeat.set(16, 4);
  const tGrate = texMetalGrate(); tGrate.repeat.set(8, 3);
  const tPlate = texMetalPlate('#1b2534'); tPlate.repeat.set(6, 6);
  const tHaz = texHazardStripeSoft(); tHaz.repeat.set(7, 1.1);

  const matFloor = new THREE.MeshStandardMaterial({ color: 0x7a7f86, roughness: 0.82, metalness: 0.16, map: tFloor });
  const matWall = new THREE.MeshStandardMaterial({ color: 0x6e767f, roughness: 0.74, metalness: 0.26, map: tWall });
  const matCatwalk = new THREE.MeshStandardMaterial({ color: 0x5a6675, roughness: 0.56, metalness: 0.52, map: tGrate });
  const matSteel = new THREE.MeshStandardMaterial({ color: 0x4e5e72, roughness: 0.58, metalness: 0.62, map: tPlate });
  const matHaz = new THREE.MeshStandardMaterial({ color: 0xb19c74, roughness: 0.44, metalness: 0.28, map: tHaz });
  const matGlow = new THREE.MeshStandardMaterial({ color: 0x55d09a, emissive: new THREE.Color(0x267e62), roughness: 0.22, metalness: 0.65 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(132, 116), matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  sceneAddArena(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(132, 116), matSteel);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 18;
  sceneAddArena(ceil);

  // Outer shell.
  [[-65, 9, 0, 2, 18, 112], [65, 9, 0, 2, 18, 112], [0, 9, -55, 132, 18, 2], [0, 9, 55, 132, 18, 2]]
    .forEach(a => addBox(...a, matWall));

  // Ground factory floor and central lower bay.
  addBox(0, 0.55, 0, 126, 1.1, 108, matFloor);
  addBox(0, 0.66, 0, 28, 1.32, 24, matSteel);

  // Mid-level catwalk network.
  addBox(0, 4.2, -20, 84, 1, 12, matCatwalk);
  addBox(0, 4.2, 20, 84, 1, 12, matCatwalk);
  addBox(-28, 4.2, 0, 12, 1, 44, matCatwalk);
  addBox(28, 4.2, 0, 12, 1, 44, matCatwalk);
  addBox(0, 4.2, 0, 24, 1, 10, matCatwalk);

  // Catwalk hazard trims.
  [[0, 4.76, -14.1, 84, 0.12, 0.9], [0, 4.76, -25.9, 84, 0.12, 0.9],
   [0, 4.76, 14.1, 84, 0.12, 0.9], [0, 4.76, 25.9, 84, 0.12, 0.9],
   [-34.1, 4.76, 0, 0.9, 0.12, 44], [-21.9, 4.76, 0, 0.9, 0.12, 44],
   [21.9, 4.76, 0, 0.9, 0.12, 44], [34.1, 4.76, 0, 0.9, 0.12, 44]]
    .forEach(([x, y, z, w, h, d]) => addBox(x, y, z, w, h, d, matHaz));

  // Upper side decks.
  addBox(-46, 7.5, -16, 24, 1, 18, matSteel);
  addBox(46, 7.5, 16, 24, 1, 18, matSteel);
  addBox(-46, 7.5, 22, 20, 1, 14, matSteel);
  addBox(46, 7.5, -22, 20, 1, 14, matSteel);

  // Vertical supports and room separators with entryways.
  [[-40, 6, -6, 3, 12, 16], [40, 6, 6, 3, 12, 16], [-12, 6, 34, 24, 12, 3], [12, 6, -34, 24, 12, 3]]
    .forEach(a => addBox(...a, matWall));
  addBox(-22, 6, -34, 8, 12, 3, matWall);
  addBox(22, 6, 34, 8, 12, 3, matWall);

  // Stairs/ramps for smooth movement between levels.
  addBox(-28, 1.2, 34, 12, 1, 10, matSteel);
  addBox(-28, 2.3, 28, 12, 1, 10, matSteel);
  addBox(-28, 3.4, 22, 12, 1, 10, matSteel);
  addBox(28, 1.2, -34, 12, 1, 10, matSteel);
  addBox(28, 2.3, -28, 12, 1, 10, matSteel);
  addBox(28, 3.4, -22, 12, 1, 10, matSteel);
  addBox(-46, 4.8, -6, 10, 1, 10, matSteel);
  addBox(-46, 6.0, -11, 10, 1, 10, matSteel);
  addBox(46, 4.8, 6, 10, 1, 10, matSteel);
  addBox(46, 6.0, 11, 10, 1, 10, matSteel);

  // Cover props.
  [[-18, 1.2, -12], [18, 1.2, 12], [0, 1.2, 36], [0, 1.2, -36], [-52, 1.2, 0], [52, 1.2, 0]]
    .forEach(([x, y, z]) => addBox(x, y, z, 6, 2.4, 6, matSteel));
  [[-54, 1.5, -16], [-54, 1.5, 16], [54, 1.5, -16], [54, 1.5, 16]].forEach(([x, y, z]) => {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3.0, 14), matSteel);
    drum.position.set(x, y, z);
    drum.castShadow = true;
    sceneAddArena(drum);
  });

  // Wall lamps / signage glow.
  [[-60, 4.2, -30], [-60, 4.2, 30], [60, 4.2, -30], [60, 4.2, 30],
   [-14, 5.2, -54], [14, 5.2, 54], [-14, 8.6, 54], [14, 8.6, -54]].forEach(([x, y, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.6, 0.35), matGlow);
    m.position.set(x, y, z);
    sceneAddArena(m);
  });

  // Atlas texturing pass (4x2 sheet):
  // [0,0]=grating [1,0]=rusted blue panel [2,0]=weathered white [3,0]=concrete
  // [0,1]=hazard [1,1]=green light [2,1]=orange glow panel [3,1]=wood crate
  const atlasLoader = new THREE.TextureLoader();
  atlasLoader.load(
    'assets/dm-factory-texture-sheet.png',
    imageTex => {
      const img = imageTex.image;
      const txGrating = makeAtlasTileTexture(img, 0, 0, 4, 2, 8, 3);
      const txBluePanel = makeAtlasTileTexture(img, 1, 0, 4, 2, 10, 4);
      const txWhitePanel = makeAtlasTileTexture(img, 2, 0, 4, 2, 10, 4);
      const txConcrete = makeAtlasTileTexture(img, 3, 0, 4, 2, 13, 10);
      const txHaz = makeAtlasTileTexture(img, 0, 1, 4, 2, 7, 1.1);
      const txGreen = makeAtlasTileTexture(img, 1, 1, 4, 2, 1, 1);
      const txOrange = makeAtlasTileTexture(img, 2, 1, 4, 2, 3, 2);
      const txWood = makeAtlasTileTexture(img, 3, 1, 4, 2, 2, 2);

      if (txConcrete) { matFloor.map = txConcrete; matFloor.needsUpdate = true; }
      if (txBluePanel) { matWall.map = txBluePanel; matWall.needsUpdate = true; }
      if (txGrating) { matCatwalk.map = txGrating; matCatwalk.needsUpdate = true; }
      if (txWhitePanel) { matSteel.map = txWhitePanel; matSteel.needsUpdate = true; }
      if (txHaz) { matHaz.map = txHaz; matHaz.needsUpdate = true; }
      if (txGreen) {
        matGlow.map = txGreen;
        matGlow.emissive = new THREE.Color(0x2cb485);
        matGlow.emissiveIntensity = 0.75;
        matGlow.needsUpdate = true;
      }

      // Orange emissive accents from atlas tile.
      if (txOrange) {
        const orangeMat = new THREE.MeshStandardMaterial({
          color: 0xf0b36a,
          roughness: 0.24,
          metalness: 0.68,
          map: txOrange,
          emissive: new THREE.Color(0x8a5a24),
          emissiveIntensity: 0.7,
        });
        [[0, 4.92, -14.1, 84, 0.08, 0.18], [0, 4.92, 14.1, 84, 0.08, 0.18],
         [-34.1, 4.92, 0, 0.18, 0.08, 44], [34.1, 4.92, 0, 0.18, 0.08, 44]].forEach(([x, y, z, w, h, d]) => {
          const a = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), orangeMat);
          a.position.set(x, y, z);
          sceneAddArena(a);
        });
      }

      // Wooden crate overlays for prop variety.
      if (txWood) {
        const woodMat = new THREE.MeshStandardMaterial({ color: 0xb59c7b, roughness: 0.78, metalness: 0.08, map: txWood });
        [[-18, 1.2, -12], [18, 1.2, 12], [0, 1.2, 36], [0, 1.2, -36]].forEach(([x, y, z]) => {
          addBox(x, y + 1.7, z, 5.4, 1.5, 5.4, woodMat);
        });
      }
    },
    undefined,
    () => {
      // Fallback is already in place via procedural textures/materials.
    }
  );

  buildSkyDome('#06090f', '#121820', '#04060b', 600, 0xc7defa);
}

function buildFactoryLights() {
  sceneAddArena(new THREE.AmbientLight(0x8fa2b4, 1.02));
  sceneAddArena(new THREE.HemisphereLight(0xa6bed2, 0x2a3138, 0.56));
  const sun = new THREE.DirectionalLight(0xe6efff, 0.96);
  sun.position.set(20, 44, 12);
  sun.castShadow = true;
  sun.shadow.bias = -0.00028;
  sun.shadow.normalBias = 0.028;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 230;
  sun.shadow.camera.left = -76;
  sun.shadow.camera.right = 76;
  sun.shadow.camera.top = 76;
  sun.shadow.camera.bottom = -76;
  sceneAddArena(sun);

  [[-60, 4.5, -30], [-60, 4.5, 30], [60, 4.5, -30], [60, 4.5, 30]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0x66ffbb, 2.4, 34);
    l.position.set(x, y, z);
    sceneAddArena(l);
  });
  [[0, 6, -20], [0, 6, 20], [-28, 6, 0], [28, 6, 0], [0, 9, 0]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xb6d8ff, 2.0, 42);
    l.position.set(x, y, z);
    sceneAddArena(l);
  });
  [[-46, 8.6, -16], [-46, 8.6, 22], [46, 8.6, 16], [46, 8.6, -22]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xffc274, 1.8, 28);
    l.position.set(x, y, z);
    sceneAddArena(l);
  });
  // Catwalk underside practicals + entrance ramps.
  [[0, 3.5, -20], [0, 3.5, 20], [-28, 3.5, 0], [28, 3.5, 0]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0x8fc5ff, 1.5, 26);
    l.position.set(x, y, z);
    sceneAddArena(l);
  });
  [[-28, 2.2, 28], [28, 2.2, -28], [-46, 5.0, -8], [46, 5.0, 8]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xffd296, 1.35, 20);
    l.position.set(x, y, z);
    sceneAddArena(l);
  });
  addRimFillLights();
}

// ── Map 6: DM-Fletcher — space hotel atrium (flat deck, wide lanes, bot-friendly) ─

function buildFletcher() {
  const tFloor = texConcreteCool(); tFloor.repeat.set(20, 18);
  const tPanel = texMetalPlate('#e4e9f4'); tPanel.repeat.set(10, 4);
  const tDark = texMetalPlate('#0c1828'); tDark.repeat.set(8, 3);
  const tGrate = texMetalGrate(); tGrate.repeat.set(10, 3);

  const matDeck = new THREE.MeshStandardMaterial({ color: 0xd4dae8, roughness: 0.8, metalness: 0.2, map: tFloor });
  const matPanel = new THREE.MeshStandardMaterial({ color: 0xc8d0e0, roughness: 0.72, metalness: 0.28, map: tPanel });
  const matWindow = new THREE.MeshStandardMaterial({
    color: 0x142a48, roughness: 0.28, metalness: 0.55,
    emissive: new THREE.Color(0x3366aa), emissiveIntensity: 0.45,
  });
  const matCarpet = new THREE.MeshStandardMaterial({ color: 0x3a4a72, roughness: 0.9, metalness: 0.06, map: tDark });
  const matTrim = new THREE.MeshStandardMaterial({
    color: 0xc4a035, roughness: 0.34, metalness: 0.78,
    emissive: new THREE.Color(0x4a3810), emissiveIntensity: 0.12,
  });
  const matRail = new THREE.MeshStandardMaterial({ color: 0x8899b8, roughness: 0.5, metalness: 0.65, map: tGrate });
  const matGlow = new THREE.MeshStandardMaterial({
    color: 0xaaddff, emissive: new THREE.Color(0x5599cc), emissiveIntensity: 0.5, roughness: 0.32, metalness: 0.45,
  });
  const matPartition = new THREE.MeshStandardMaterial({ color: 0xa8b8d0, roughness: 0.74, metalness: 0.26, map: tPanel });
  const matHalf = new THREE.MeshStandardMaterial({ color: 0x9aaec8, roughness: 0.68, metalness: 0.32, map: tGrate });
  const matCrate = new THREE.MeshStandardMaterial({ color: 0x6a7a94, roughness: 0.62, metalness: 0.55, map: tGrate });
  const matPlanter = new THREE.MeshStandardMaterial({ color: 0x2d4a38, roughness: 0.88, metalness: 0.08, map: tDark });

  // Single continuous main deck (top y ≈ 1.1) — easy navigation for bots / learned nav.
  addBox(0, 0.55, 0, 112, 1.1, 96, matDeck);

  // Outer hull (enclosed station — no void gaps inside play volume).
  [[-56, 9, 0, 4, 18, 100], [56, 9, 0, 4, 18, 100], [0, 9, -48, 112, 18, 4], [0, 9, 48, 112, 18, 4]]
    .forEach(a => addBox(...a, matPanel));
  addBox(0, 16.2, 0, 112, 2.4, 96, matPanel);

  // Central lobby carpet (same walk height — thin inlay).
  addBox(0, 1.14, 0, 40, 0.1, 40, matCarpet);

  // ── Major sightline breaks: cross-shaped partition with ~16-unit central opening ──
  const wh = 3.35;
  const wy = 1.1 + wh * 0.5;
  const thick = 1.35;
  // East–west segments at z = ±20 (x from outer wall to ±8, gap −8…+8).
  addBox(-29, wy, -20, 42, wh, thick, matPartition);
  addBox(29, wy, -20, 42, wh, thick, matPartition);
  addBox(-29, wy, 20, 42, wh, thick, matPartition);
  addBox(29, wy, 20, 42, wh, thick, matPartition);
  // North–south segments at x = ±22 (z from outer wall to ±8).
  addBox(-22, wy, -29, thick, wh, 42, matPartition);
  addBox(-22, wy, 29, thick, wh, 42, matPartition);
  addBox(22, wy, -29, thick, wh, 42, matPartition);
  addBox(22, wy, 29, thick, wh, 42, matPartition);

  // Diagonal stagger walls — break long corner-to-corner sightlines (gaps ≥ 7m).
  const wh2 = 2.75;
  const wy2 = 1.1 + wh2 * 0.5;
  const t2 = 1.2;
  addBox(-34, wy2, -34, t2, wh2, 22, matPartition);
  addBox(34, wy2, 34, t2, wh2, 22, matPartition);
  addBox(-34, wy2, 34, 22, wh2, t2, matPartition);
  addBox(34, wy2, -34, 22, wh2, t2, matPartition);

  // Mid-field slivers — extra breaks without sealing lanes.
  addBox(0, wy2, -34, 18, wh2, t2, matPartition);
  addBox(0, wy2, 34, 18, wh2, t2, matPartition);
  addBox(-34, wy2, 0, t2, wh2, 18, matPartition);
  addBox(34, wy2, 0, t2, wh2, 18, matPartition);

  // Quarter wings — flank cover near outer ring.
  addBox(-46, wy, 0, 8, wh, 1.2, matPartition);
  addBox(46, wy, 0, 8, wh, 1.2, matPartition);
  addBox(0, wy, -42, 1.2, wh, 10, matPartition);
  addBox(0, wy, 42, 1.2, wh, 10, matPartition);

  // Perimeter ring bulkheads (window strips — visual only, inside shell).
  [[-54, 6, -32, 2, 6, 28], [-54, 6, 32, 2, 6, 28], [54, 6, -32, 2, 6, 28], [54, 6, 32, 2, 6, 28]]
    .forEach(a => addBox(...a, matWindow));
  [[0, 6, -46, 100, 6, 2], [0, 6, 46, 100, 6, 2]].forEach(a => addBox(...a, matWindow));

  // Gold trim + handrails (low collision — mostly above head height on walls).
  [[-56, 1.1, -46, 112, 0.2, 0.35], [-56, 1.1, 46, 112, 0.2, 0.35], [-56, 1.1, 0, 0.35, 0.2, 96], [56, 1.1, 0, 0.35, 0.2, 96]]
    .forEach(a => addBox(...a, matTrim));

  // Columns — primary ring + extra inner ring for cover without narrow dead ends.
  [[-36, 2.2, -28, 3.2, 2.4, 3.2], [36, 2.2, -28, 3.2, 2.4, 3.2], [-36, 2.2, 28, 3.2, 2.4, 3.2], [36, 2.2, 28, 3.2, 2.4, 3.2],
   [-36, 2.2, 0, 3.2, 2.4, 3.2], [36, 2.2, 0, 3.2, 2.4, 3.2], [0, 2.2, -36, 3.2, 2.4, 3.2], [0, 2.2, 36, 3.2, 2.4, 3.2]]
    .forEach(a => addBox(...a, matTrim));
  [[-22, 2.05, -14, 2.6, 2.1, 2.6], [22, 2.05, -14, 2.6, 2.1, 2.6], [-22, 2.05, 14, 2.6, 2.1, 2.6], [22, 2.05, 14, 2.6, 2.1, 2.6],
   [-14, 2.05, -22, 2.6, 2.1, 2.6], [14, 2.05, -22, 2.6, 2.1, 2.6], [-14, 2.05, 22, 2.6, 2.1, 2.6], [14, 2.05, 22, 2.6, 2.1, 2.6]]
    .forEach(a => addBox(...a, matTrim));

  // Chest-height peek rails (half walls).
  const hh = 1.15;
  const hy = 1.1 + hh * 0.5;
  [[-10, hy, -6, 8, hh, 1.1], [10, hy, 6, 8, hh, 1.1], [-8, hy, 8, 1.1, hh, 7], [8, hy, -8, 1.1, hh, 7],
   [-46, hy, -18, 12, hh, 1], [46, hy, 18, 12, hh, 1], [-46, hy, 18, 12, hh, 1], [46, hy, -18, 12, hh, 1]]
    .forEach(a => addBox(...a, matHalf));

  // Concierge + service kiosks (higher than before — blocks more LOS).
  [[-18, 1.55, -10, 14, 0.95, 4.5], [18, 1.55, 10, 14, 0.95, 4.5], [-32, 1.45, 8, 10, 0.75, 6], [32, 1.45, -8, 10, 0.75, 6]]
    .forEach(a => addBox(...a, matRail));

  // Planters (wide, low–mid cover).
  [[-48, 1.5, -36, 5, 1.0, 10], [48, 1.5, 36, 5, 1.0, 10], [-48, 1.5, 36, 5, 1.0, 10], [48, 1.5, -36, 5, 1.0, 10],
   [0, 1.45, -44, 14, 0.9, 5], [0, 1.45, 44, 14, 0.9, 5]]
    .forEach(a => addBox(...a, matPlanter));

  // Luggage / equipment clusters (small repeatables).
  const crate = (x, z, w = 2.2, d = 2.2) => addBox(x, 1.1 + 0.55, z, w, 1.1, d, matCrate);
  crate(-40, -8); crate(-38, -10); crate(40, 8); crate(38, 10);
  crate(-8, -40); crate(-10, -38); crate(8, 40); crate(10, 38);
  crate(-26, 26); crate(-24, 28); crate(26, -26); crate(24, -28);
  crate(-34, 4); crate(-36, 2); crate(34, -4); crate(36, -2);
  crate(4, 34); crate(2, 36); crate(-4, -34); crate(-2, -36);
  crate(-12, -12); crate(12, 12); crate(-14, 14); crate(14, -14);

  // Overhead light troughs (visual hierarchy).
  [[0, 8.8, 0, 52, 0.35, 3], [0, 8.8, -30, 52, 0.35, 2.5], [0, 8.8, 30, 52, 0.35, 2.5], [-34, 8.8, 0, 3, 0.35, 52], [34, 8.8, 0, 3, 0.35, 52]]
    .forEach(a => addBox(...a, matGlow));

  buildSkyDome('#020612', '#0a1838', '#040814', 720, 0xa8ccff);
}

function buildFletcherLights() {
  sceneAddArena(new THREE.AmbientLight(0xc0d0f0, 0.88));
  sceneAddArena(new THREE.HemisphereLight(0xe8f0ff, 0x303848, 0.52));
  const sun = new THREE.DirectionalLight(0xf0f6ff, 0.82);
  sun.position.set(28, 52, 22);
  sun.castShadow = true;
  sun.shadow.bias = -0.00026;
  sun.shadow.normalBias = 0.026;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 220;
  sun.shadow.camera.left = -72;
  sun.shadow.camera.right = 72;
  sun.shadow.camera.top = 72;
  sun.shadow.camera.bottom = -72;
  sceneAddArena(sun);

  [[0, 3.2, 0], [-40, 3.2, -24], [40, 3.2, 24], [-40, 3.2, 24], [40, 3.2, -24], [0, 3.2, -38], [0, 3.2, 38]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xb8dcff, 2.2, 42);
    l.position.set(x, y, z);
    sceneAddArena(l);
  });
  [[-52, 2.4, 0], [52, 2.4, 0], [0, 2.4, -44], [0, 2.4, 44]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xffe8c8, 1.45, 36);
    l.position.set(x, y, z);
    sceneAddArena(l);
  });
  [[-22, 3.4, -20], [22, 3.4, -20], [-22, 3.4, 20], [22, 3.4, 20], [0, 3.2, 0]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xd0e8ff, 1.25, 28);
    l.position.set(x, y, z);
    sceneAddArena(l);
  });
  addRimFillLights();
}

// ── Map 7: CTF-Face (inspired by Facing Worlds) ───────────────────────────────

function buildCtfFace() {
  const tStone = texGothicWall(); tStone.repeat.set(7, 6);
  const tMetal = texMetalPlate('#1a2232'); tMetal.repeat.set(6, 6);
  const tGrate = texMetalGrate(); tGrate.repeat.set(6, 3);
  const tHaz = texHazardStripeSoft(); tHaz.repeat.set(3, 1);

  const matGround = new THREE.MeshStandardMaterial({ color: 0x484a58, roughness: 0.88, metalness: 0.1, map: tStone });
  const matTower = new THREE.MeshStandardMaterial({ color: 0x7d808f, roughness: 0.74, metalness: 0.2, map: tStone });
  const matDeck = new THREE.MeshStandardMaterial({ color: 0x4b5f7d, roughness: 0.54, metalness: 0.6, map: tMetal });
  const matBridge = new THREE.MeshStandardMaterial({ color: 0x576e8d, roughness: 0.5, metalness: 0.7, map: tGrate });
  const matTrim = new THREE.MeshStandardMaterial({ color: 0xb9a16d, roughness: 0.42, metalness: 0.34, map: tHaz });
  const matLamp = new THREE.MeshStandardMaterial({ color: 0x7aaeff, emissive: new THREE.Color(0x2a4f88), roughness: 0.2, metalness: 0.7 });
  const matBlueTeam = new THREE.MeshStandardMaterial({ color: 0x5e91ff, emissive: new THREE.Color(0x16325f), emissiveIntensity: 0.25, roughness: 0.46, metalness: 0.52 });
  const matRedTeam = new THREE.MeshStandardMaterial({ color: 0xff6d64, emissive: new THREE.Color(0x591b19), emissiveIntensity: 0.25, roughness: 0.46, metalness: 0.52 });

  // Asteroid chunk + carved playable slab.
  const asteroid = new THREE.Mesh(new THREE.CylinderGeometry(98, 114, 14, 22), matGround);
  asteroid.position.set(0, -6.2, 0);
  asteroid.receiveShadow = true;
  sceneAddArena(asteroid);
  addBox(0, 0.5, 0, 154, 1, 74, matGround);
  addBox(0, 0.72, 0, 78, 0.55, 30, matDeck); // center carved shelf

  const towerX = 58;
  for (const sx of [-1, 1]) {
    const x = sx * towerX;
    const teamMat = sx < 0 ? matBlueTeam : matRedTeam;

    // Primary tower stack (hollow shell with explicit visible door portals).
    // Back wall split with central doorway.
    addBox(x - 7.2, 10.5, 12.2, 11.6, 21, 1.6, matTower);
    addBox(x + 7.2, 10.5, 12.2, 11.6, 21, 1.6, matTower);
    addBox(x, 17.8, 12.2, 8.0, 6.4, 1.6, matTower);      // lintel above opening
    // Front wall split with central doorway.
    addBox(x - 7.2, 10.5, -12.2, 11.6, 21, 1.6, matTower);
    addBox(x + 7.2, 10.5, -12.2, 11.6, 21, 1.6, matTower);
    addBox(x, 17.8, -12.2, 8.0, 6.4, 1.6, matTower);     // lintel above opening
    addBox(x + 12.2, 10.5, 0, 1.6, 21, 22.8, matTower);  // side wall
    addBox(x - 12.2, 10.5, 0, 1.6, 21, 22.8, matTower);  // side wall
    // Keep doorway centers open (no center blocker).
    addBox(x, 18.6, 0, 30, 1.8, 30, matDeck);   // roof platform
    addBox(x, 6.0, 0, 18, 1, 18, matDeck);      // mid interior floor
    addBox(x, 2.0, 0, 20, 1, 20, matDeck);      // lower floor

    // Crown and battlement silhouette.
    addBox(x, 20.2, 0, 20, 1, 20, matBridge);
    [[x, 21.0, 12.6, 18, 0.5, 1.0], [x, 21.0, -12.6, 18, 0.5, 1.0],
     [x + 12.6, 21.0, 0, 1.0, 0.5, 18], [x - 12.6, 21.0, 0, 1.0, 0.5, 18]]
      .forEach(([bx, by, bz, bw, bh, bd]) => addBox(bx, by, bz, bw, bh, bd, matTrim));

    // Team color identity strips (very readable from center lanes).
    addBox(x - sx * 12.9, 10.4, 0, 0.45, 10.5, 18.5, teamMat);
    addBox(x, 18.3, 0, 19.2, 0.24, 0.6, teamMat);

    // Side decks and recognizable “sniper pads”.
    addBox(x, 12.9, 11.4, 11, 1, 6.2, matDeck);
    addBox(x, 12.9, -11.4, 11, 1, 6.2, matDeck);
    addBox(x - sx * 14.6, 9.8, 8.8, 5.5, 1, 5.5, matBridge);
    addBox(x - sx * 14.6, 9.8, -8.8, 5.5, 1, 5.5, matBridge);

    // Front entry frame toward bridge (no blocker in the middle).
    addBox(x - sx * 12.2, 4.8, 4.6, 2.9, 5.2, 1.4, matGround);
    addBox(x - sx * 12.2, 4.8, -4.6, 2.9, 5.2, 1.4, matGround);
    addBox(x - sx * 8.9, 2.8, 4.6, 2.2, 1.3, 1.4, matTrim);
    addBox(x - sx * 8.9, 2.8, -4.6, 2.2, 1.3, 1.4, matTrim);
    // Guaranteed walkable ingress from lane into flag room.
    addBox(x - sx * 14.4, 1.35, 0, 6.0, 0.7, 8.8, matDeck);
    addBox(x - sx * 11.4, 1.75, 0, 4.4, 0.6, 8.8, matDeck);

    // Rear ramp system for base access.
    addBox(x + sx * 18.5, 1.0, 0, 12.5, 1, 12.5, matDeck);
    addBox(x + sx * 22.6, 2.0, 0, 10.5, 1, 10.5, matDeck);
    addBox(x + sx * 26.4, 3.0, 0, 8.5, 1, 8.5, matDeck);

    // Side alcoves / mini rooms.
    addBox(x, 7.8, 12.2, 8.6, 6.2, 8.2, matDeck);
    addBox(x, 7.8, -12.2, 8.6, 6.2, 8.2, matDeck);

    // Team beacons on tower crown.
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), teamMat);
    beacon.position.set(x, 21.4, 0);
    sceneAddArena(beacon);

    // Extra tower fidelity pass (inspired by ctf-face.html): buttresses/spires/ring details.
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dz]) => {
      addBox(x + dx * 9.6, 10.8, dz * 9.6, 2.8, 17.2, 2.8, matTower);      // buttress core
      addBox(x + dx * 9.6, 10.8, dz * 9.6, 1.8, 17.2, 1.8, matDeck);       // buttress inlay
      addBox(x + dx * 10.6, 22.8, dz * 10.6, 1.2, 3.0, 1.2, matTrim);      // finial base
      addBox(x + dx * 10.6, 24.8, dz * 10.6, 0.7, 1.2, 0.7, teamMat);      // team-tinted cap
    });
    [11.2, 14.2, 17.2].forEach((yy, i) => {
      const tone = i === 1 ? matDeck : matTower;
      addBox(x, yy, 0, 14.6 + i * 1.6, 0.28, 14.6 + i * 1.6, tone);        // shaft rings
    });
    // Tower vertical ribs to boost silhouette readability at long distance.
    [[0, 10.6], [0, -10.6], [10.6, 0], [-10.6, 0]].forEach(([rx, rz]) => {
      addBox(x + rx, 13.6, rz, Math.abs(rx) > 0 ? 0.9 : 7.8, 6.6, Math.abs(rz) > 0 ? 0.9 : 7.8, matTower);
    });
  }

  // Dual-lane bridge with wide center split (Face hallmark).
  addBox(0, 9.5, 10.5, 90, 1, 7.6, matBridge);
  addBox(0, 9.5, -10.5, 90, 1, 7.6, matBridge);
  addBox(0, 10.05, 14.3, 90, 0.1, 0.22, matTrim);
  addBox(0, 10.05, 6.7, 90, 0.1, 0.22, matTrim);
  addBox(0, 10.05, -6.7, 90, 0.1, 0.22, matTrim);
  addBox(0, 10.05, -14.3, 90, 0.1, 0.22, matTrim);

  // Mid-bridge silhouette + jumpable support.
  addBox(0, 5.2, 0, 11, 10.4, 20, matTower);
  addBox(0, 10.8, 0, 7, 0.8, 10, matDeck);

  // Ground cover/landmarks.
  [[-34, 1.2, 24], [-34, 1.2, -24], [34, 1.2, 24], [34, 1.2, -24], [0, 1.2, 28], [0, 1.2, -28]]
    .forEach(([x, y, z]) => addBox(x, y, z, 6, 2.4, 6, matDeck));

  // Small marker lamps.
  [[-58, 19.0, 0], [58, 19.0, 0], [-16, 10.8, 10.5], [16, 10.8, -10.5], [0, 10.8, 10.5], [0, 10.8, -10.5]]
    .forEach(([x, y, z]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.46, 10, 10), matLamp);
      m.position.set(x, y, z);
      sceneAddArena(m);
    });

  buildSkyDome('#091331', '#21406f', '#02070f', 4200, 0xd6eaff);
}

function buildCtfFaceLights() {
  sceneAddArena(new THREE.AmbientLight(0x65759f, 0.86));
  sceneAddArena(new THREE.HemisphereLight(0x8ca7d6, 0x1a2536, 0.56));
  const moon = new THREE.DirectionalLight(0xd0ddff, 1.02);
  moon.position.set(28, 54, 8);
  moon.castShadow = true;
  moon.shadow.bias = -0.00028;
  moon.shadow.normalBias = 0.028;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.near = 0.5;
  moon.shadow.camera.far = 260;
  moon.shadow.camera.left = -95;
  moon.shadow.camera.right = 95;
  moon.shadow.camera.top = 95;
  moon.shadow.camera.bottom = -95;
  sceneAddArena(moon);

  [[-58, 19.0, 0], [58, 19.0, 0], [-44, 9.7, 10.5], [44, 9.7, -10.5], [0, 10.8, 10.5], [0, 10.8, -10.5]]
    .forEach(([x, y, z]) => {
      const l = new THREE.PointLight(0x7aafff, 2.5, 46);
      l.position.set(x, y, z);
      sceneAddArena(l);
    });
  [[-58, 6.4, 0], [58, 6.4, 0], [0, 6.5, 24], [0, 6.5, -24], [0, 6.0, 0]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xffbf74, 1.55, 32);
    l.position.set(x, y, z);
    sceneAddArena(l);
  });
  addRimFillLights();
}

// ── Map 7: Debug Lab ───────────────────────────────────────────────────────────
const debugSoundPads = [];
const debugStatScreens = [];
const debugDisplayBots = [];
const debugLiquidTargets = [];
window.__TA_DEBUG_SOUND_PADS = debugSoundPads;
window.__TA_DEBUG_STAT_SCREENS = debugStatScreens;
window.__TA_DEBUG_DISPLAY_BOTS = debugDisplayBots;
window.__TA_DEBUG_LIQUID_TARGETS = debugLiquidTargets;
const DEBUG_ART_IMAGES = [
  { src: 'assets/menu-bg.png', title: 'Start Menu Background' },
  { src: 'assets/dm-factory-texture-sheet.png', title: 'DM-Factory Texture Sheet' },
  { src: 'assets/dm-codex-texture-sheet.png', title: 'DM-Codex Texture Sheet' },
  { src: 'assets/dm-deck16-texture-sheet.png', title: 'DM-DECK16 Texture Sheet' },
  { src: 'assets/dm-morpheus-texture-sheet.png', title: 'DM-Morpheus Texture Sheet' },
  { src: 'assets/dm-phobos-texture-sheet.png', title: 'DM-Phobos Texture Sheet' },
  { src: 'assets/red-and-blue.png', title: 'CTF Red and Blue Flags' },
];

function buildDebugLab() {
  debugSoundPads.length = 0;
  debugStatScreens.length = 0;
  debugDisplayBots.length = 0;
  debugLiquidTargets.length = 0;

  const tDebugFloor = texMetalPlate('#1d2d42'); tDebugFloor.repeat.set(28, 28);
  const tDebugWall = texIndustrialWall(); tDebugWall.repeat.set(10, 3);
  const tDebugHazard = texHazardStripeSoft(); tDebugHazard.repeat.set(3, 1.2);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2b3b52, roughness: 0.72, metalness: 0.24, map: tDebugFloor, emissive: new THREE.Color(0x08131f), emissiveIntensity: 0.08 });
  const gridMat = new THREE.MeshStandardMaterial({ color: 0x4b6f96, roughness: 0.45, metalness: 0.82, emissive: 0x14304a, emissiveIntensity: 0.62 });
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x6a7f99, roughness: 0.35, metalness: 0.74, map: tDebugFloor, emissive: new THREE.Color(0x0c1b2a), emissiveIntensity: 0.06 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x425a77, roughness: 0.5, metalness: 0.62, map: tDebugWall, emissive: new THREE.Color(0x0b1524), emissiveIntensity: 0.08 });
  const hazardMat = new THREE.MeshStandardMaterial({ color: 0xa18c6b, roughness: 0.45, metalness: 0.3, map: tDebugHazard });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  sceneAddArena(floor);

  for (let i = -7; i <= 7; i++) {
    const gx = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 130), gridMat);
    gx.position.set(i * 8, 0.03, 0);
    sceneAddArena(gx);
    const gz = new THREE.Mesh(new THREE.BoxGeometry(130, 0.06, 0.2), gridMat);
    gz.position.set(0, 0.03, i * 8);
    sceneAddArena(gz);
  }

  // Model display: all bot variants.
  for (let i = 0; i < 8; i++) {
    const px = -52 + i * 15;
    addBox(px, 0.65, -22, 6, 1.3, 6, panelMat);
    if (typeof window.createBotMesh === 'function' || typeof createProceduralBotMesh === 'function') {
      const created = (typeof window.createBotMesh === 'function') ? window.createBotMesh(i) : null;
      const m = created && created.mesh ? created.mesh : createProceduralBotMesh(i);
      m.position.set(px, 1.75, -22);
      m.rotation.y = Math.PI;
      m.userData.debugDisplay = true;
      if (created && created.mixer) m.userData.debugAnimMixer = created.mixer;
      debugDisplayBots.push(m);
      sceneAddArena(m);
    }
  }

  // Material library: representative set from all maps + bots/weapon families.
  const materialSet = [
    { color: 0x8a7868, roughness: 0.88, metalness: 0.05 }, // Gothic floor
    { color: 0x9a7858, roughness: 0.82, metalness: 0.1 }, // Gothic wall
    { color: 0x607080, roughness: 0.55, metalness: 0.5 }, // Gothic platform
    { color: 0xBB9945, roughness: 0.35, metalness: 0.85, emissive: 0x332808 },
    { color: 0xff5500, roughness: 0.3, metalness: 0.4, emissive: 0xff3300 },
    { color: 0x00cc55, roughness: 0.3, metalness: 0.7, emissive: 0x008833 },
    { color: 0x404870, roughness: 0.85, metalness: 0.5 }, // Deck base
    { color: 0x506090, roughness: 0.7, metalness: 0.65 }, // Deck steel
    { color: 0x3a5080, roughness: 0.55, metalness: 0.75 }, // Deck grate
    { color: 0x0055ee, roughness: 0.15, metalness: 0.9, emissive: 0x002277 },
    { color: 0xff5500, roughness: 0.3, metalness: 0.4, emissive: 0xcc3300 },
    { color: 0xd8dce8, roughness: 0.65, metalness: 0.15 }, // Morpheus marble
    { color: 0x4466ff, roughness: 0.1, metalness: 1.0, emissive: 0x2244ee },
    { color: 0x3355cc, roughness: 0.2, metalness: 0.9, emissive: 0x1133aa },
    { color: 0x7a8290, roughness: 0.82, metalness: 0.24 }, // Phobos moon
    { color: 0x5a6474, roughness: 0.72, metalness: 0.38 },
    { color: 0x606878, roughness: 0.58, metalness: 0.48 },
    { color: 0xff7722, roughness: 0.3, metalness: 0.48, emissive: 0x883310 },
    { color: 0xffbb55, roughness: 0.26, metalness: 0.52, emissive: 0x663318 },
    { color: 0xcc2244, roughness: 0.38, metalness: 0.72, emissive: 0x22080e }, // Bot style
    { color: 0x2255cc, roughness: 0.38, metalness: 0.72, emissive: 0x081022 },
    { color: 0x22cc55, roughness: 0.38, metalness: 0.72, emissive: 0x082210 },
    { color: 0x353042, roughness: 0.32, metalness: 0.9, emissive: 0x1a1020 }, // Weapon body
    { color: 0xff44cc, roughness: 0.18, metalness: 0.88, emissive: 0xff2288 }, // Weapon glow
  ];
  const cols = 8;
  for (let i = 0; i < materialSet.length; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const px = -52 + col * 15;
    const pz = 10 + row * 14;
    addBox(px, 0.55, pz, 6.5, 1.1, 6.5, panelMat);
    const spec = materialSet[i];
    const mat = new THREE.MeshStandardMaterial({
      color: spec.color,
      roughness: spec.roughness,
      metalness: spec.metalness,
      emissive: new THREE.Color(spec.emissive || 0x000000),
      emissiveIntensity: spec.emissive ? 0.55 : 0,
    });
    const mesh = i % 2 === 0
      ? new THREE.Mesh(new THREE.SphereGeometry(2.05, 20, 16), mat)
      : new THREE.Mesh(new THREE.BoxGeometry(3.3, 3.3, 3.3), mat);
    mesh.position.set(px, 3.45, pz);
    mesh.castShadow = true;
    if (i % 2 === 0) {
      mesh.userData.debugLiquidTarget = true;
      mesh.userData.debugLiquidState = { timer: 0, duration: 1.4 };
      debugLiquidTargets.push(mesh);
    }
    sceneAddArena(mesh);
  }

  // Texture gallery room: compact version of the debug room concept.
  addBox(-44, 1.05, -46, 42, 2.1, 28, panelMat);      // room floor
  addBox(-44, 9.2, -46, 42, 1.2, 28, frameMat);       // room ceiling
  addBox(-65, 5.2, -46, 1.2, 8.2, 28, frameMat);      // west wall
  addBox(-23, 5.2, -46, 1.2, 8.2, 28, frameMat);      // east wall
  addBox(-44, 5.2, -60, 42, 8.2, 1.2, frameMat);      // north wall
  // south wall with doorway to main arena
  addBox(-57, 5.2, -32, 16, 8.2, 1.2, frameMat);
  addBox(-31, 5.2, -32, 16, 8.2, 1.2, frameMat);
  // connector corridor + small slope
  addBox(-44, 1.05, -36, 18, 2.1, 10, panelMat);
  addBox(-53, 5.0, -36, 1.2, 7.8, 10, frameMat);
  addBox(-35, 5.0, -36, 1.2, 7.8, 10, frameMat);
  addBox(-44, 0.35, -28.8, 18, 0.7, 2.8, panelMat);
  addBox(-44, 0.95, -30.3, 18, 0.9, 2.8, panelMat);
  addBox(-44, 1.65, -31.8, 18, 0.9, 2.8, panelMat);
  makeDebugSign(-44, 7.75, -32.25, 0, 'Texture Gallery');

  // Art gallery: spread across back + side walls to avoid clipping.
  const loader = new THREE.TextureLoader();
  const panelW = 7.0;
  const panelH = 2.6;
  const gallerySlots = [
    // Back wall (north, facing south)
    { x: -55.0, y: 6.7, z: -59.35, ry: 0 },
    { x: -44.0, y: 6.7, z: -59.35, ry: 0 },
    { x: -33.0, y: 6.7, z: -59.35, ry: 0 },
    { x: -55.0, y: 3.7, z: -59.35, ry: 0 },
    { x: -44.0, y: 3.7, z: -59.35, ry: 0 },
    { x: -33.0, y: 3.7, z: -59.35, ry: 0 },
    // West wall (facing center)
    { x: -64.35, y: 6.7, z: -53.0, ry: Math.PI / 2 },
    { x: -64.35, y: 3.7, z: -53.0, ry: Math.PI / 2 },
    { x: -64.35, y: 6.7, z: -39.0, ry: Math.PI / 2 },
    { x: -64.35, y: 3.7, z: -39.0, ry: Math.PI / 2 },
    // East wall (facing center)
    { x: -23.65, y: 6.7, z: -53.0, ry: -Math.PI / 2 },
    { x: -23.65, y: 3.7, z: -53.0, ry: -Math.PI / 2 },
    { x: -23.65, y: 6.7, z: -39.0, ry: -Math.PI / 2 },
    { x: -23.65, y: 3.7, z: -39.0, ry: -Math.PI / 2 },
  ];
  for (let i = 0; i < DEBUG_ART_IMAGES.length; i++) {
    const slot = gallerySlots[i % gallerySlots.length];
    const x = slot.x;
    const y = slot.y;
    const z = slot.z;
    const ry = slot.ry;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(panelW + 0.6, panelH + 0.6, 0.6), frameMat);
    frame.position.set(x, y, z);
    frame.rotation.y = ry;
    frame.castShadow = true;
    sceneAddArena(frame);

    const tex = loader.load(DEBUG_ART_IMAGES[i].src);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    const artMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.62,
      metalness: 0.1,
    });
    const art = new THREE.Mesh(new THREE.PlaneGeometry(panelW, panelH), artMat);
    art.position.set(x, y, z);
    art.rotation.y = ry;
    const nx = Math.sin(ry), nz = Math.cos(ry);
    art.position.x += nx * 0.35;
    art.position.z += nz * 0.35;
    sceneAddArena(art);
  }

  function addSoundPad(x, z, color, key) {
    const padMat = new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color).multiplyScalar(0.5),
      emissiveIntensity: 0.9,
      roughness: 0.25,
      metalness: 0.72,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.7, 18), panelMat);
    base.position.set(x, 0.35, z);
    sceneAddArena(base);
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.38, 18), padMat);
    btn.position.set(x, 0.95, z);
    btn.userData.debugSoundKey = key;
    btn.castShadow = true;
    sceneAddArena(btn);
    debugSoundPads.push(btn);
  }

  function makeStatsScreenPanel(x, y, z, ry, title) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(11.2, 6.8, 0.5), frameMat);
    frame.position.set(x, y, z);
    frame.rotation.y = ry;
    frame.castShadow = true;
    sceneAddArena(frame);

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    const screenMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.3,
      metalness: 0.2,
      emissive: new THREE.Color(0x0a1a2a),
      emissiveIntensity: 0.42,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 5.8), screenMat);
    screen.position.set(x, y, z);
    screen.rotation.y = ry;
    const nx = Math.sin(ry), nz = Math.cos(ry);
    screen.position.x += nx * 0.30;
    screen.position.z += nz * 0.30;
    sceneAddArena(screen);
    debugStatScreens.push({ title, canvas, ctx, tex, screen });
  }

  function makeDebugSign(x, y, z, ry, text) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(10.8, 2.6, 0.45), frameMat);
    frame.position.set(x, y, z);
    frame.rotation.y = ry;
    frame.castShadow = true;
    sceneAddArena(frame);

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#061524';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(120,190,255,0.45)';
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    ctx.fillStyle = '#7ad4ff';
    ctx.font = '700 92px Orbitron, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text || 'DEBUG ROOM', canvas.width / 2, canvas.height / 2 + 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.28,
      metalness: 0.24,
      emissive: new THREE.Color(0x0a1a2a),
      emissiveIntensity: 0.35,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10.1, 2.0), mat);
    sign.position.set(x, y, z);
    sign.rotation.y = ry;
    const nx = Math.sin(ry), nz = Math.cos(ry);
    sign.position.x += nx * 0.26;
    sign.position.z += nz * 0.26;
    sceneAddArena(sign);
  }

  function drawStatsScreen(screenObj, lines, accent = '#66ccff') {
    const { canvas, ctx, tex, title } = screenObj;
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#04101c';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(12,34,52,0.88)');
    g.addColorStop(1, 'rgba(4,14,22,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(18, 18, w - 36, h - 36);
    ctx.strokeStyle = 'rgba(120,190,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, w - 36, h - 36);

    ctx.fillStyle = accent;
    ctx.font = '700 36px Orbitron, Arial';
    ctx.fillText(title || 'DEBUG PANEL', 44, 74);

    ctx.fillStyle = '#cfe8ff';
    ctx.font = '26px ui-monospace, Consolas, monospace';
    let y = 126;
    for (const ln of lines) {
      ctx.fillText(String(ln), 44, y);
      y += 44;
      if (y > h - 36) break;
    }
    tex.needsUpdate = true;
  }

  const actions = Array.isArray(window.__TA_DEBUG_SOUND_ACTIONS) ? window.__TA_DEBUG_SOUND_ACTIONS : [
    { id: 'weapon_fire', color: 0xff44cc }, { id: 'jump', color: 0x66ccff },
    { id: 'death', color: 0xff5555 }, { id: 'round_start', color: 0x55ffcc },
  ];
  const soundCols = 8;
  for (let i = 0; i < actions.length; i++) {
    const row = Math.floor(i / soundCols);
    const col = i % soundCols;
    const x = -52 + col * 15;
    const z = 44 + row * 11;
    addSoundPad(x, z, actions[i].color || 0x66ccff, actions[i].id);
  }

  // Server room: dedicated debug chamber with live stat screens.
  addBox(44, 1.05, -46, 42, 2.1, 28, panelMat);      // room floor
  addBox(44, 9.2, -46, 42, 1.2, 28, frameMat);       // room ceiling
  addBox(23, 5.2, -46, 1.2, 8.2, 28, frameMat);      // west wall
  addBox(65, 5.2, -46, 1.2, 8.2, 28, frameMat);      // east wall
  addBox(44, 5.2, -60, 42, 8.2, 1.2, frameMat);      // north wall
  // south wall with doorway to main arena
  addBox(31, 5.2, -32, 16, 8.2, 1.2, frameMat);
  addBox(57, 5.2, -32, 16, 8.2, 1.2, frameMat);
  // connector corridor
  addBox(44, 1.05, -36, 18, 2.1, 10, panelMat);
  addBox(35, 5.0, -36, 1.2, 7.8, 10, frameMat);
  addBox(53, 5.0, -36, 1.2, 7.8, 10, frameMat);
  addBox(44, 0.12, -32.25, 10.5, 0.06, 0.9, hazardMat);
  // Entry slope (outside -> inside): stepped ramp to avoid jump requirement.
  addBox(44, 0.35, -28.8, 18, 0.7, 2.8, panelMat);
  addBox(44, 0.95, -30.3, 18, 0.9, 2.8, panelMat);
  addBox(44, 1.65, -31.8, 18, 0.9, 2.8, panelMat);

  // Compact panel layout: keep entrance clear, use side + back walls.
  makeStatsScreenPanel(24.2, 5.2, -48, Math.PI / 2, 'SERVER / SESSION');
  makeStatsScreenPanel(63.8, 5.2, -48, -Math.PI / 2, 'PERF / RENDER');
  makeStatsScreenPanel(37.4, 5.2, -58.8, 0, 'COMBAT / FLOW (last match)');
  makeStatsScreenPanel(50.6, 5.2, -58.8, 0, 'LAST END SCORE');
  makeDebugSign(44, 7.75, -32.25, 0, 'Debug Room');

  function updateDebugPanels(stats) {
    const s = stats || {};
    const panel0 = debugStatScreens[0];
    const panel1 = debugStatScreens[1];
    const panel2 = debugStatScreens[2];
    const panel3 = debugStatScreens[3];
    if (panel0) {
      drawStatsScreen(panel0, [
        `Mode           ${s.menuMode || 'single'}`,
        `Map            ${s.mapName || '-'}`,
        `Round active   ${s.roundActive ? 'yes' : 'no'}`,
        `Round timer    ${s.roundTimerText || '-'}`,
        `Players/Bots   ${s.aliveBots || 0}/${s.totalBots || 0}`,
        `Paused         ${s.paused ? 'yes' : 'no'}`,
        `MP active      ${s.mpActive ? 'yes' : 'no'}`,
        `Server slot    ${s.mpSlot ?? '-'}`,
      ], '#7ad4ff');
    }
    if (panel1) {
      drawStatsScreen(panel1, [
        `FPS            ${s.fps ?? '-'}`,
        `Frame dt       ${s.dtMs ?? '-'} ms`,
        `Draw calls     ${s.drawCalls ?? '-'}`,
        `Triangles      ${s.triangles ?? '-'}`,
        `Lines/Points   ${s.lines ?? '-'}/${s.points ?? '-'}`,
        `Particles      ${s.particles ?? '-'}`,
        `Beams          ${s.beams ?? '-'}`,
        `Resolution     ${s.resolution || '-'}`,
      ], '#8effc9');
    }
    if (panel2) {
      drawStatsScreen(panel2, [
        `Last mode      ${s.matchMode || '-'}`,
        `End reason     ${s.matchReason || '-'}`,
        `Winner         ${s.matchWinner || '-'}`,
        `You K/D        ${s.kills ?? 0}/${s.deaths ?? 0}`,
        `Accuracy       ${s.accuracy ?? '0%'} (${s.shotsHit ?? 0}/${s.shotsFired ?? 0})`,
        `Best spree     ${s.bestSpree ?? 0}`,
        `Longest life   ${s.longestLifeText || '—'}`,
        `Ended at       ${s.matchEndedAt || '-'}`,
      ], '#ffb26b');
    }
    if (panel3) {
      const scoreLines = Array.isArray(s.matchScoreLines) && s.matchScoreLines.length
        ? s.matchScoreLines
        : ['No completed match yet.'];
      drawStatsScreen(panel3, scoreLines, '#ffd37a');
    }
  }
  window.__TA_DEBUG_UPDATE_PANELS = updateDebugPanels;
  updateDebugPanels();

  // Bounds walls.
  addBox(-68, 6, 0, 2, 12, 150, panelMat);
  addBox(68, 6, 0, 2, 12, 150, panelMat);
  addBox(0, 6, -68, 136, 12, 2, panelMat);
  addBox(0, 6, 82, 136, 12, 2, panelMat);

  buildSkyDome('#060c16', '#0f1b2f', '#04070f', 450, 0x99bbff);
}

function buildDebugLabLights() {
  sceneAddArena(new THREE.AmbientLight(0xa8c0de, 1.22));
  const sun = new THREE.DirectionalLight(0xe8f2ff, 1.15);
  sun.position.set(24, 42, 18);
  sun.castShadow = true;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.024;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 260;
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sceneAddArena(sun);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      const l = new THREE.PointLight(0x9fd8ff, 2.1, 30);
      l.position.set(-52 + col * 15, 2.6, 44 + row * 11);
      sceneAddArena(l);
    }
  }
  // Extra fill for server room readability.
  [[30, 6, -46], [58, 6, -46], [44, 6.5, -56], [44, 5.5, -37]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xc8e4ff, 1.6, 26);
    l.position.set(x, y, z);
    sceneAddArena(l);
  });
  addRimFillLights();
}

// ── Map configuration & spawn points ────────────────────────────────────────

let currentMap = 0;
const MAP_COUNT  = 9;
const MAP_NAMES  = ['GOTHIC ARENA', 'DM-DECK16', 'DM-MORPHEUS', 'DM-PHOBOS', 'DM-CODEX', 'DM-FACTORY', 'DM-FLETCHER', 'CTF-FACE', 'DEBUG LAB'];
const MAP_BOUNDS = [[57, 57], [49, 39], [62, 52], [58, 58], [61, 61], [63, 55], [56, 48], [74, 34], [66, 66]];

const SPAWN_POINTS = [
  // Map 0: Gothic Arena
  [
    [0, 5.5, 0], [-28, 4, -28], [28, 4, -28], [-28, 4, 28], [28, 4, 28],
    [-42, 6.5, 0], [42, 6.5, 0], [0, 6.5, -42], [0, 6.5, 42],
    [-15, 1, 15], [15, 1, 15], [-15, 1, -15], [15, 1, -15],
    [0, 1, 20], [0, 1, -20], [20, 1, 0], [-20, 1, 0],
  ],
  // Map 1: DM-Deck16
  [
    [-35, 1.1, -32], [35, 1.1, -32], [-35, 1.1, 32], [35, 1.1, 32],
    [-15, 1.1, 0], [15, 1.1, 0], [0, 1.1, -25], [0, 1.1, 25],
    [47, 4.1, -22], [47, 4.1, 22], [-47, 4.1, -22], [-47, 4.1, 22],
    [0, 5.6, -8], [0, 5.6, 8], [-15, 5.6, 0], [15, 5.6, 0], [0, 5.6, 0],
    [-30, 7.1, 0], [30, 7.1, 0], [0, 7.1, 0],
  ],
  // Map 2: DM-Morpheus
  [
    [0, 1.1, 0], [-10, 1.1, -10], [10, 1.1, 10], [-10, 1.1, 10], [10, 1.1, -10],
    [14, 2.6, 14], [-14, 2.6, -14], [14, 2.6, -14], [-14, 2.6, 14],
    [22, 4.1, 22], [-22, 4.1, -22], [22, 4.1, -22], [-22, 4.1, 22],
    [34, 6.6, 0], [-34, 6.6, 0], [0, 6.6, 30], [0, 6.6, -30],
    [28, 9.2, 22], [-28, 9.2, -22], [28, 9.2, -22], [-28, 9.2, 22],
  ],
  // Map 3: DM-Phobos
  [
    [0, 1.1, 0], [-20, 1.1, 0], [20, 1.1, 0], [0, 1.1, -20], [0, 1.1, 20],
    [-36, 3.8, -36], [36, 3.8, -36], [-36, 3.8, 36], [36, 3.8, 36],
    [0, 6.4, 0], [-14, 3.8, 0], [14, 3.8, 0], [0, 3.8, -14], [0, 3.8, 14],
    [-44, 2.7, 0], [44, 2.7, 0], [0, 2.7, -44], [0, 2.7, 44],
    [-48, 1.1, -48], [48, 1.1, 48], [-48, 1.1, 48], [48, 1.1, -48],
  ],
  // Map 4: DM-Codex (simple navigation-friendly spawns)
  [
    [4, 4.3, 0], [-40, 1.3, -26], [-30, 2.3, -16], [-20, 3.3, -6],
    [-44, 1.3, 40], [-44, 3.2, 40], [42, 1.3, 20], [46, 2.8, 10],
    [50, 4.3, 0], [42, 1.3, -20], [2, 1.3, 24], [2, 1.3, -24],
  ],
  // Map 5: DM-Factory
  [
    [0, 1.1, 0], [0, 4.8, -20], [0, 4.8, 20], [-28, 4.8, 0], [28, 4.8, 0],
    [-46, 8.1, -16], [-46, 8.1, 22], [46, 8.1, 16], [46, 8.1, -22],
    [-28, 4.0, 22], [28, 4.0, -22], [-52, 1.1, 0], [52, 1.1, 0],
    [0, 1.1, 36], [0, 1.1, -36], [-18, 1.1, -12], [18, 1.1, 12],
  ],
  // Map 6: DM-Fletcher (space hotel — flat deck, wide lanes, bot-friendly)
  [
    [0, 1.1, 0], [-32, 1.1, 0], [32, 1.1, 0], [0, 1.1, -32], [0, 1.1, 32],
    [-44, 1.1, -28], [44, 1.1, 28], [-44, 1.1, 28], [44, 1.1, -28],
    [-24, 1.1, -16], [24, 1.1, 16], [-24, 1.1, 16], [24, 1.1, -16],
    [-52, 1.1, 0], [52, 1.1, 0], [0, 1.1, -40], [0, 1.1, 40],
  ],
  // Map 7: CTF-Face
  [
    [-58, 2.8, 0], [-58, 6.9, 0], [-58, 13.6, 11.4], [-58, 13.6, -11.4], [-58, 19.6, 0],
    [58, 2.8, 0], [58, 6.9, 0], [58, 13.6, 11.4], [58, 13.6, -11.4], [58, 19.6, 0],
    [-30, 10.1, 10.5], [-30, 10.1, -10.5], [0, 10.1, 10.5], [0, 10.1, -10.5],
    [30, 10.1, 10.5], [30, 10.1, -10.5], [0, 1.2, 28], [0, 1.2, -28],
  ],
  // Map 8: Debug Lab
  [
    [0, 1.2, 0], [-52, 1.2, -22], [53, 1.2, -22], [0, 1.2, 16], [0, 1.2, 44],
    [-44, 1.2, 44], [54, 1.2, 44], [-60, 1.2, 0], [60, 1.2, 0], [0, 1.2, -60],
  ],
];

const CLASSIC_ITEM_SPAWNS = [
  // Map 0
  [
    { type: 'weapon_shock', x: 0, y: 1.4, z: 18 },
    { type: 'weapon_rocket', x: -32, y: 4.5, z: -18 },
    { type: 'health', x: 18, y: 1.2, z: 0 },
    { type: 'health', x: -18, y: 1.2, z: 0 },
    { type: 'thigh_pads', x: 0, y: 1.2, z: -20 },
    { type: 'body_armor', x: 34, y: 4, z: 0 },
    { type: 'ammo_cells', x: 26, y: 4, z: 22 },
    { type: 'ammo_rockets', x: -26, y: 4, z: -22 },
    { type: 'udamage', x: 0, y: 6.6, z: 0 },
  ],
  // Map 1
  [
    { type: 'weapon_shock', x: 0, y: 1.3, z: 0 },
    { type: 'weapon_rocket', x: 47, y: 4.3, z: 0 },
    { type: 'health', x: -34, y: 1.2, z: -26 },
    { type: 'health', x: 34, y: 1.2, z: 26 },
    { type: 'body_armor', x: 0, y: 5.8, z: 0 },
    { type: 'shield_belt', x: 0, y: 1.1, z: -25 },
    { type: 'ammo_cells', x: -15, y: 5.8, z: 0 },
    { type: 'ammo_rockets', x: 15, y: 5.8, z: 0 },
    { type: 'udamage', x: 0, y: 7.3, z: 0 },
  ],
  // Map 2
  [
    { type: 'weapon_shock', x: 0, y: 1.2, z: 0 },
    { type: 'weapon_rocket', x: 22, y: 4.3, z: 22 },
    { type: 'health', x: -10, y: 1.2, z: -10 },
    { type: 'health', x: 10, y: 1.2, z: 10 },
    { type: 'shield_belt', x: 0, y: 6.7, z: 0 },
    { type: 'ammo_cells', x: -22, y: 4.3, z: -22 },
    { type: 'ammo_rockets', x: 34, y: 6.8, z: 0 },
  ],
  // Map 3
  [
    { type: 'weapon_shock', x: 0, y: 1.2, z: -20 },
    { type: 'weapon_rocket', x: 0, y: 6.5, z: 0 },
    { type: 'health', x: -20, y: 1.2, z: 0 },
    { type: 'health', x: 20, y: 1.2, z: 0 },
    { type: 'body_armor', x: 0, y: 1.2, z: 20 },
    { type: 'thigh_pads', x: -44, y: 2.8, z: 0 },
    { type: 'ammo_cells', x: -36, y: 3.9, z: 36 },
    { type: 'ammo_rockets', x: 36, y: 3.9, z: -36 },
    { type: 'udamage', x: 0, y: 2.8, z: 44 },
  ],
  // Map 4
  [
    { type: 'weapon_shock', x: 2, y: 1.4, z: 24 },
    { type: 'weapon_rocket', x: 42, y: 1.4, z: -20 },
    { type: 'health', x: -40, y: 1.4, z: -26 },
    { type: 'health', x: 42, y: 1.4, z: 20 },
    { type: 'body_armor', x: 4, y: 4.5, z: 0 },
    { type: 'thigh_pads', x: -44, y: 3.3, z: 40 },
    { type: 'ammo_cells', x: -30, y: 2.4, z: -16 },
    { type: 'ammo_rockets', x: 50, y: 4.4, z: 0 },
  ],
  // Map 5
  [
    { type: 'weapon_shock', x: 0, y: 1.2, z: 0 },
    { type: 'weapon_rocket', x: -46, y: 8.2, z: -16 },
    { type: 'health', x: 0, y: 1.2, z: -36 },
    { type: 'health', x: 0, y: 1.2, z: 36 },
    { type: 'shield_belt', x: 28, y: 4.9, z: 0 },
    { type: 'ammo_cells', x: -28, y: 4.9, z: 0 },
    { type: 'ammo_rockets', x: 46, y: 8.2, z: 16 },
    { type: 'udamage', x: 0, y: 5, z: 20 },
  ],
  // Map 6: DM-Fletcher
  [
    { type: 'weapon_shock', x: -28, y: 1.35, z: 0 },
    { type: 'weapon_rocket', x: 28, y: 1.35, z: 0 },
    { type: 'health', x: -40, y: 1.35, z: 32 },
    { type: 'health', x: 40, y: 1.35, z: -32 },
    { type: 'body_armor', x: 0, y: 1.35, z: -36 },
    { type: 'shield_belt', x: 44, y: 1.35, z: 0 },
    { type: 'ammo_cells', x: -44, y: 1.35, z: 0 },
    { type: 'ammo_rockets', x: 0, y: 1.35, z: 36 },
    { type: 'udamage', x: 0, y: 1.35, z: 28 },
  ],
  // Map 7: CTF-Face
  [
    { type: 'weapon_shock', x: -30, y: 10.2, z: 10.5 },
    { type: 'weapon_rocket', x: 30, y: 10.2, z: -10.5 },
    { type: 'health', x: -58, y: 2.9, z: 0 },
    { type: 'health', x: 58, y: 2.9, z: 0 },
    { type: 'shield_belt', x: 0, y: 10.2, z: 0 },
    { type: 'ammo_cells', x: 0, y: 1.3, z: 28 },
    { type: 'ammo_rockets', x: 0, y: 1.3, z: -28 },
    { type: 'udamage', x: 0, y: 19.8, z: 0 },
  ],
  [],
];

function randomSpawn() {
  const pts = SPAWN_POINTS[currentMap];
  return pts[Math.floor(Math.random() * pts.length)];
}
