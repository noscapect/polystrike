// Multiplayer client — authoritative server (server/index.js). Loads after game.js + maps.js + bots.js.
(function () {
  /** Overwritten when the module finishes loading; no-op until then. */
  window.__TA_MP_SEND_FIRE = function () {};
  /** Procedural pawns are authored for BOT_HEIGHT (1.8); humans use PLAYER_H (2.2) on the server — scale up so remotes match. */
  const VIS_PLAYER_H = typeof PLAYER_H === 'number' ? PLAYER_H : 2.2;
  const VIS_BOT_H = typeof BOT_HEIGHT === 'number' ? BOT_HEIGHT : 1.8;
  const REMOTE_HUMAN_SCALE = VIS_PLAYER_H / VIS_BOT_H;

  let ws = null;
  let mpSlot = -1;
  let lastSpace = false;
  let lastSnap = null;
  let lastSnapRecvTime = 0;
  let lastSnapServerNow = 0;
  let lastSnapTick = -1;

  const remoteMeshes = [];
  const remoteTarget = [];
  const remoteLastPos = [];
  const remoteNetState = [];
  const remoteHistory = [];

  let rttEma = 0.08;
  let jitterEma = 0.01;
  let lastPingSentAt = 0;
  let pingSeq = 0;
  const pendingPings = new Map();
  const PING_INTERVAL_MS = 1000;
  const SNAP_TICK_SEC = 1 / 25;
  const MAX_EXTRAP_SEC = 0.18;
  const LOCAL_HARD_SNAP_DIST = 12;
  const MAX_HUMAN_SPEED = 30;
  const MAX_BOT_SPEED = 22;
  const MAX_REMOTE_STEP = 16;
  const REMOTE_HISTORY_MAX_SEC = 2.0;
  const REMOTE_MAX_EXTRAP_SEC = 0.09;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function angleLerp(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  /** Throttle movement keys/yaw — keep under ~60/s so server sees smooth input between 25Hz ticks. */
  const INPUT_MIN_MS = 16;
  let lastInputSend = 0;
  let pendingJump = false;
  const DODGE_WINDOW = 0.28;
  const lastTap = { w: 0, a: 0, s: 0, d: 0 };
  const prevKeyDown = { w: false, a: false, s: false, d: false };
  let pendingDodgeDir = null;

  let mpPrevOnGround = true;
  let mpLastMeY = 0;
  let mpMapIdx = -1;

  const mpTargetPos = new THREE.Vector3();
  let mpSnapInitialized = false;
  const mpVel = new THREE.Vector3();

  function clampVelocity3(vx, vy, vz, maxLen) {
    const len = Math.hypot(vx, vy, vz);
    if (len <= maxLen || len < 1e-6) return { x: vx, y: vy, z: vz };
    const s = maxLen / len;
    return { x: vx * s, y: vy * s, z: vz * s };
  }

  function getOrCreateMpPlayerId() {
    try {
      let id = localStorage.getItem('ta_mp_player_id');
      if (!id || id.length < 8) {
        id =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : 'mp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('ta_mp_player_id', id);
      }
      return id;
    } catch (_) {
      return 'mp_' + String(Math.random()).slice(2, 14);
    }
  }

  function applyMpProgress(raw) {
    if (!raw || typeof raw !== 'object') return;
    const p = {
      totalXp: raw.totalXp,
      level: raw.level,
      xpInLevel: raw.xpInLevel,
      xpForNextLevel: raw.xpForNextLevel,
    };
    window.__TA_MP_PROGRESS = p;
    try {
      localStorage.setItem('ta_mp_last_progress', JSON.stringify(p));
    } catch (_) {}
    if (typeof window.__TA_MP_ON_PROGRESS === 'function') window.__TA_MP_ON_PROGRESS(p);
  }

  function queueSnap(msg) {
    applySnap(msg);
  }

  function applyMpMapIndex(mapIdx) {
    const mi = Number(mapIdx);
    if (!Number.isFinite(mi)) return;
    if (mi === mpMapIdx) return;
    mpMapIdx = mi;
    if (typeof currentMap === 'number' && typeof rebuildArenaForCurrentMap === 'function') {
      if (currentMap !== mi) {
        currentMap = mi;
        rebuildArenaForCurrentMap();
        if (typeof clearAllBots === 'function') clearAllBots();
      }
    }
  }

  function applySnap(snap) {
    if (!snap || !snap.entities) return;
    applyMpMapIndex(snap.mapIdx);
    const snapTick = Number.isFinite(snap.tick) ? snap.tick : lastSnapTick + 1;
    if (snapTick <= lastSnapTick) return;
    const tickDelta = lastSnapTick >= 0 ? snapTick - lastSnapTick : 1;
    lastSnapTick = snapTick;
    lastSnap = snap;
    const nowSec = performance.now() / 1000;
    const prevRecv = lastSnapRecvTime || nowSec;
    const recvDt = Math.max(0.001, nowSec - prevRecv);
    lastSnapRecvTime = nowSec;
    lastSnapServerNow = Number.isFinite(snap.serverNow)
      ? snap.serverNow
      : lastSnapServerNow + recvDt;
    window.__TA_MP_STATE = {
      active: true,
      slot: mpSlot,
      roundTimer: snap.roundTimer,
      roundActive: snap.roundActive,
      intermission: snap.intermission || 0,
      lastSnap: snap,
    };

    const me = snap.entities.find(e => e.slot === mpSlot);
    if (me && typeof playerObj !== 'undefined') {
      if (mpSnapInitialized) {
        const simDt = Math.min(0.2, Math.max(0.02, tickDelta * SNAP_TICK_SEC));
        const v = clampVelocity3(
          (me.x - mpTargetPos.x) / simDt,
          (me.y - mpTargetPos.y) / simDt,
          (me.z - mpTargetPos.z) / simDt,
          MAX_HUMAN_SPEED
        );
        mpVel.set(v.x, v.y, v.z);
      } else {
        mpVel.set(0, 0, 0);
      }
      mpTargetPos.set(me.x, me.y, me.z);
      if (!mpSnapInitialized) {
        playerObj.position.copy(mpTargetPos);
        mpSnapInitialized = true;
      }
      if (typeof state !== 'undefined') {
        state.alive = me.alive;
        state.kills = me.kills;
        state.deaths = me.deaths;
        if (me.shootCd != null) state.cooldown = me.shootCd;
        if (!me.alive && typeof deathscr !== 'undefined') deathscr.style.display = 'flex';
        else if (me.alive && typeof deathscr !== 'undefined') deathscr.style.display = 'none';
      }
      const og = me.onGround !== false;
      if (
        mpPrevOnGround === false &&
        og &&
        typeof playLandSound === 'function'
      ) {
        playLandSound(mpLastMeY - me.y > 3.5);
      }
      mpPrevOnGround = og;
      mpLastMeY = me.y;
    }

    for (const e of snap.entities) {
      if (e.slot === mpSlot) continue;
      const m = remoteMeshes[e.slot];
      if (!m) continue;
      m.visible = e.alive;
      if (e.alive) {
        const sc = e.isBot ? 1 : REMOTE_HUMAN_SCALE;
        if (Math.abs((m.scale.x || 1) - sc) > 0.001) m.scale.setScalar(sc);
        const sample = {
          serverNow: lastSnapServerNow,
          x: e.x,
          y: e.y,
          z: e.z,
          yaw: e.yaw,
        };
        if (!remoteHistory[e.slot]) remoteHistory[e.slot] = [];
        const hist = remoteHistory[e.slot];
        if (!hist.length || sample.serverNow > hist[hist.length - 1].serverNow) {
          hist.push(sample);
        } else {
          hist[hist.length - 1] = sample;
        }
        while (
          hist.length > 2 &&
          sample.serverNow - hist[0].serverNow > REMOTE_HISTORY_MAX_SEC
        ) {
          hist.shift();
        }
        while (hist.length > 80) hist.shift();
        let ns = remoteNetState[e.slot];
        if (!ns) {
          ns = {
            x: e.x,
            y: e.y,
            z: e.z,
            vx: 0,
            vy: 0,
            vz: 0,
            recvTime: nowSec,
            serverNow: lastSnapServerNow,
          };
          remoteNetState[e.slot] = ns;
        } else {
          const simDt = Math.min(0.25, Math.max(0.02, tickDelta * SNAP_TICK_SEC));
          const dx = e.x - ns.x;
          const dy = e.y - ns.y;
          const dz = e.z - ns.z;
          const step = Math.hypot(dx, dy, dz);
          const vmax = e.isBot ? MAX_BOT_SPEED : MAX_HUMAN_SPEED;
          if (step > MAX_REMOTE_STEP) {
            ns.vx = 0;
            ns.vy = 0;
            ns.vz = 0;
          } else {
            const v = clampVelocity3(dx / simDt, dy / simDt, dz / simDt, vmax);
            ns.vx = v.x;
            ns.vy = v.y;
            ns.vz = v.z;
          }
          ns.x = e.x;
          ns.y = e.y;
          ns.z = e.z;
          ns.recvTime = nowSec;
          ns.serverNow = lastSnapServerNow;
        }
        if (!remoteTarget[e.slot]) remoteTarget[e.slot] = new THREE.Vector3(e.x, e.y, e.z);
        else remoteTarget[e.slot].set(e.x, e.y, e.z);
        m.rotation.y = sample.yaw;
      } else if (remoteHistory[e.slot]) {
        remoteHistory[e.slot].length = 0;
      }
    }
  }

  window.__TA_MP_TICK = function (dt) {
    if (!ws || ws.readyState !== 1 || mpSlot < 0) return;
    const nowPerf = performance.now();
    const nowSec = nowPerf / 1000;

    if (nowPerf - lastPingSentAt >= PING_INTERVAL_MS) {
      const id = pingSeq++ & 0xfffffff;
      pendingPings.set(id, nowPerf);
      ws.send(JSON.stringify({ t: 'ping', id, clientTs: nowPerf }));
      lastPingSentAt = nowPerf;
      if (pendingPings.size > 32) {
        const keys = pendingPings.keys();
        pendingPings.delete(keys.next().value);
      }
    }

    if (mpSnapInitialized && typeof playerObj !== 'undefined') {
      const localSnapStale = Math.max(0, nowSec - (lastSnapRecvTime || nowSec));
      const localExtrapScale = localSnapStale > 0.16 ? 0 : 1;
      const aheadSec = Math.min(
        MAX_EXTRAP_SEC,
        Math.max(0.015, rttEma * 0.5 + SNAP_TICK_SEC * 0.5 + jitterEma * 0.75)
      ) * localExtrapScale;
      const predX = mpTargetPos.x + mpVel.x * aheadSec;
      const predY = mpTargetPos.y + mpVel.y * aheadSec;
      const predZ = mpTargetPos.z + mpVel.z * aheadSec;
      const dist = Math.hypot(
        predX - playerObj.position.x,
        predY - playerObj.position.y,
        predZ - playerObj.position.z
      );
      if (dist > LOCAL_HARD_SNAP_DIST) {
        playerObj.position.set(predX, predY, predZ);
      } else if (dist > 0.001) {
        const catchup = dist > 1.5 ? 42 : 30;
        const a = 1 - Math.exp(-dt * catchup);
        playerObj.position.x += (predX - playerObj.position.x) * a;
        playerObj.position.y += (predY - playerObj.position.y) * a;
        playerObj.position.z += (predZ - playerObj.position.z) * a;
      }
      if (dist < 0.03) {
        playerObj.position.set(predX, predY, predZ);
      }
    }

    const remoteAheadSec = Math.min(
      MAX_EXTRAP_SEC,
      Math.max(0.02, rttEma * 0.5 + SNAP_TICK_SEC * 0.75 + jitterEma)
    );
    const interpDelay = clamp(
      SNAP_TICK_SEC * 2 + jitterEma * 2.2 + rttEma * 0.25,
      0.07,
      0.2
    );
    const estServerNow =
      lastSnapServerNow + Math.max(0, nowSec - (lastSnapRecvTime || nowSec));
    const renderServerTime = estServerNow - interpDelay;
    for (let s = 0; s < 8; s++) {
      if (s === mpSlot || !remoteMeshes[s] || !remoteTarget[s]) continue;
      const m = remoteMeshes[s];
      if (!m.visible) continue;
      const hist = remoteHistory[s];
      if (hist && hist.length) {
        let tx = hist[hist.length - 1].x;
        let ty = hist[hist.length - 1].y;
        let tz = hist[hist.length - 1].z;
        let tyaw = hist[hist.length - 1].yaw;
        if (hist.length >= 2) {
          const first = hist[0];
          const last = hist[hist.length - 1];
          if (renderServerTime <= first.serverNow) {
            tx = first.x;
            ty = first.y;
            tz = first.z;
            tyaw = first.yaw;
          } else if (renderServerTime >= last.serverNow) {
            const prev = hist[hist.length - 2];
            const denom = Math.max(1e-4, last.serverNow - prev.serverNow);
            const snapStaleFor = Math.max(0, estServerNow - last.serverNow);
            const exCap = snapStaleFor > 0.18 ? 0 : REMOTE_MAX_EXTRAP_SEC;
            const ex = clamp(renderServerTime - last.serverNow, 0, exCap);
            const vx = (last.x - prev.x) / denom;
            const vy = (last.y - prev.y) / denom;
            const vz = (last.z - prev.z) / denom;
            const vmax = MAX_BOT_SPEED;
            const cv = clampVelocity3(vx, vy, vz, vmax);
            tx = last.x + cv.x * ex;
            ty = last.y + cv.y * ex;
            tz = last.z + cv.z * ex;
            tyaw = last.yaw;
          } else {
            for (let i = hist.length - 2; i >= 0; i--) {
              const a = hist[i];
              const b = hist[i + 1];
              if (renderServerTime >= a.serverNow && renderServerTime <= b.serverNow) {
                const t = clamp(
                  (renderServerTime - a.serverNow) / Math.max(1e-4, b.serverNow - a.serverNow),
                  0,
                  1
                );
                tx = a.x + (b.x - a.x) * t;
                ty = a.y + (b.y - a.y) * t;
                tz = a.z + (b.z - a.z) * t;
                tyaw = angleLerp(a.yaw, b.yaw, t);
                break;
              }
            }
          }
        }
        remoteTarget[s].set(tx, ty, tz);
        m.rotation.y = angleLerp(m.rotation.y, tyaw, Math.min(1, dt * 20));
      } else {
        const ns = remoteNetState[s];
        if (ns) {
          const snapAge = Math.max(0, nowSec - ns.recvTime);
          const useAhead = snapAge > 0.11 ? 0 : remoteAheadSec;
          remoteTarget[s].set(
            ns.x + ns.vx * useAhead,
            ns.y + ns.vy * useAhead,
            ns.z + ns.vz * useAhead
          );
        }
      }
      const gap = m.position.distanceTo(remoteTarget[s]);
      if (gap > 16) {
        m.position.copy(remoteTarget[s]);
        continue;
      }
      const smoothHz = gap > 2.5 ? 26 : 18;
      const a = 1 - Math.exp(-dt * smoothHz);
      m.position.lerp(remoteTarget[s], a);
    }

    const snapAnim = lastSnap;
    if (snapAnim && snapAnim.entities && typeof applyProceduralPoseToMesh === 'function') {
      for (let s = 0; s < 8; s++) {
        if (s === mpSlot || !remoteMeshes[s]) continue;
        const ent = snapAnim.entities.find(e => e.slot === s);
        const m = remoteMeshes[s];
        if (!ent || !ent.alive || !m.visible) continue;
        if (!remoteLastPos[s]) remoteLastPos[s] = new THREE.Vector3().copy(m.position);
        let spd = remoteLastPos[s].distanceTo(m.position) / Math.max(dt, 1e-6);
        if (spd > 22) spd = 14;
        remoteLastPos[s].copy(m.position);
        applyProceduralPoseToMesh(m, dt, spd, ent.onGround !== false, true);
      }
    }

    const gi = typeof window.__TA_GET_INPUT === 'function' ? window.__TA_GET_INPUT() : null;
    if (!gi) return;

    function keyDownDir(k) {
      if (k === 'w') return !!(gi.keys.w || gi.keys.arrowup);
      if (k === 's') return !!(gi.keys.s || gi.keys.arrowdown);
      if (k === 'a') return !!(gi.keys.a || gi.keys.arrowleft);
      if (k === 'd') return !!(gi.keys.d || gi.keys.arrowright);
      return false;
    }
    for (const k of ['w', 'a', 's', 'd']) {
      const down = keyDownDir(k);
      const edge = down && !prevKeyDown[k];
      prevKeyDown[k] = down;
      if (edge) {
        if (lastTap[k] && nowSec - lastTap[k] < DODGE_WINDOW) {
          pendingDodgeDir = k;
          lastTap[k] = 0;
          if (typeof sfxDodge === 'function') sfxDodge();
        } else {
          lastTap[k] = nowSec;
        }
      }
    }

    const sp = !!gi.keys[' '] || !!gi.keys['spacebar'];
    const jumpEdge = sp && !lastSpace;
    lastSpace = sp;
    if (jumpEdge) pendingJump = true;

    const now = performance.now();
    const flushNow = pendingJump || pendingDodgeDir;
    if (!flushNow && now - lastInputSend < INPUT_MIN_MS) return;
    lastInputSend = now;

    const payload = {
      t: 'input',
      w: !!(gi.keys.w || gi.keys.arrowup),
      a: !!(gi.keys.a || gi.keys.arrowleft),
      s: !!(gi.keys.s || gi.keys.arrowdown),
      d: !!(gi.keys.d || gi.keys.arrowright),
      yaw: gi.yaw,
      pitch: gi.pitch,
      jump: pendingJump,
    };
    if (pendingDodgeDir) payload.dodgeDir = pendingDodgeDir;

    if (pendingJump && typeof playJumpSound === 'function') playJumpSound();

    ws.send(JSON.stringify(payload));
    pendingJump = false;
    pendingDodgeDir = null;
  };

  window.__TA_MP_TRY_START = function () {
    const cb = document.getElementById('mp-enabled');
    const urlEl = document.getElementById('mp-url');
    const forced = !!window.__TA_MP_FORCE_CONNECT;
    if (!forced && (!cb || !cb.checked)) return Promise.resolve(false);

    const url = (window.__TA_MP_FORCE_URL && String(window.__TA_MP_FORCE_URL).trim()) || (urlEl && urlEl.value.trim()) || 'ws://localhost:8080';
    return new Promise((resolve, reject) => {
      try {
        ws = new WebSocket(url);
      } catch (e) {
        reject(e);
        return;
      }

      const to = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 12000);

      ws.onopen = () => {
        const name =
          typeof getPlayerName === 'function' ? getPlayerName() : 'Player';
        ws.send(
          JSON.stringify({
            t: 'hello',
            name: String(name).slice(0, 20),
            playerId: getOrCreateMpPlayerId(),
          })
        );
      };

      ws.onerror = () => {
        clearTimeout(to);
        reject(new Error('WebSocket error'));
      };

      ws.onmessage = ev => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch (_) {
          return;
        }

        if (msg.t === 'pong') {
          const sentAt = pendingPings.get(msg.id);
          if (typeof sentAt === 'number') {
            pendingPings.delete(msg.id);
            const rtt = Math.max(0.001, (performance.now() - sentAt) / 1000);
            const delta = Math.abs(rtt - rttEma);
            rttEma += (rtt - rttEma) * 0.2;
            jitterEma += (delta - jitterEma) * 0.18;
          }
          return;
        }

        if (msg.t === 'deny') {
          clearTimeout(to);
          try {
            ws.close();
          } catch (_) {}
          reject(new Error(msg.reason || 'Server denied connection'));
          return;
        }

        if (msg.t === 'welcome') {
          clearTimeout(to);
          mpSlot = msg.slot;
          window.__TA_MP_ACTIVE = true;
          if (typeof clearAllBots === 'function') clearAllBots();

          for (let i = 0; i < 8; i++) {
            if (remoteMeshes[i]) {
              scene.remove(remoteMeshes[i]);
              remoteMeshes[i].traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) {
                  const mats = Array.isArray(o.material) ? o.material : [o.material];
                  mats.forEach(m => m && m.dispose());
                }
              });
              remoteMeshes[i] = null;
            }
          }

          for (let i = 0; i < 8; i++) {
            if (i === mpSlot) {
              remoteMeshes[i] = null;
              continue;
            }
            if (typeof createProceduralBotMesh !== 'function') continue;
            const mesh = createProceduralBotMesh(i);
            scene.add(mesh);
            remoteMeshes[i] = mesh;
          }

          mpSnapInitialized = false;
          mpVel.set(0, 0, 0);
          lastSnapRecvTime = 0;
          lastSnapServerNow = 0;
          lastSnapTick = -1;
          mpMapIdx = -1;
          for (let i = 0; i < 8; i++) remoteLastPos[i] = undefined;
          for (let i = 0; i < 8; i++) remoteNetState[i] = undefined;
          for (let i = 0; i < 8; i++) remoteHistory[i] = undefined;
          pendingPings.clear();
          rttEma = 0.08;
          jitterEma = 0.01;
          pingSeq = 0;
          lastPingSentAt = 0;
          for (const k of ['w', 'a', 's', 'd']) {
            lastTap[k] = 0;
            prevKeyDown[k] = false;
          }
          pendingDodgeDir = null;
          mpPrevOnGround = true;
          if (msg.progress) applyMpProgress(msg.progress);
          applySnap(msg.snap);
          resolve(true);
          return;
        }

        if (msg.t === 'progress') {
          const payload = Object.assign({}, msg);
          delete payload.t;
          applyMpProgress(payload);
          return;
        }

        if (msg.t === 'snap') {
          queueSnap(msg);
          return;
        }

        if (msg.t === 'kill') {
          const ks = msg.killerSlot;
          const vs = msg.victimSlot;
          const ke = lastSnap && lastSnap.entities.find(e => e.slot === ks);
          const ve = lastSnap && lastSnap.entities.find(e => e.slot === vs);
          if (typeof addKillFeedEntry === 'function' && ke && ve) {
            const col = ks === mpSlot ? 0xff44cc : typeof BOT_COLORS !== 'undefined' ? BOT_COLORS[ks].body : 0xff8833;
            addKillFeedEntry(ke.name, ve.name, col);
          }
          if (ks === mpSlot && ve && typeof window.__TA_MP_ON_LOCAL_FRAG === 'function') {
            window.__TA_MP_ON_LOCAL_FRAG(ve.name);
          }
          if (vs === mpSlot && typeof camera !== 'undefined') {
            const pp = new THREE.Vector3();
            camera.getWorldPosition(pp);
            if (typeof spawnInstagibKillExplosion === 'function') {
              spawnInstagibKillExplosion(pp, 0xff44cc);
            }
            if (typeof sfxDeath === 'function') sfxDeath();
            if (typeof playDeathSound === 'function') playDeathSound();
          } else if (ve && remoteMeshes[vs]) {
            const p = remoteMeshes[vs].position.clone().add(new THREE.Vector3(0, 1, 0));
            const c =
              typeof BOT_COLORS !== 'undefined' ? BOT_COLORS[vs].body : 0xcc2244;
            if (typeof spawnInstagibKillExplosion === 'function')
              spawnInstagibKillExplosion(p, c);
          }
          return;
        }

        if (msg.t === 'round_end') {
          window.__TA_MP_RANKINGS = (msg.ranks || []).map((r, i) => {
            const hex =
              typeof BOT_COLORS !== 'undefined'
                ? BOT_COLORS[r.slot % 8].body
                : 0xff8833;
            return {
              name: r.name,
              kills: r.kills,
              deaths: r.deaths,
              color: '#' + (hex & 0xffffff).toString(16).padStart(6, '0'),
              isPlayer: r.slot === mpSlot,
              fakePing: r.slot === mpSlot ? 0 : 30 + r.slot * 3,
            };
          });
          if (typeof showRoundEndMP === 'function') showRoundEndMP();
          return;
        }

        if (msg.t === 'round_start') {
          window.__TA_MP_RANKINGS = null;
          if (typeof roundEndEl !== 'undefined') roundEndEl.style.display = 'none';
        }
      };

      ws.onclose = () => {
        window.__TA_MP_ACTIVE = false;
        window.__TA_MP_STATE = null;
        window.__TA_MP_PROGRESS = null;
        mpMapIdx = -1;
        pendingPings.clear();
        lastSnapRecvTime = 0;
        lastSnapServerNow = 0;
        lastSnapTick = -1;
        mpVel.set(0, 0, 0);
        window.__TA_MP_SEND_FIRE = function () {};
        if (typeof window.refreshMenuProfileName === 'function') window.refreshMenuProfileName();
        clearTimeout(to);
      };
    });
  };

  window.__TA_MP_DISCONNECT = function () {
    if (ws) {
      try {
        ws.close();
      } catch (_) {}
    }
    ws = null;
    mpSlot = -1;
    window.__TA_MP_ACTIVE = false;
    window.__TA_MP_PROGRESS = null;
    pendingPings.clear();
    lastSnapRecvTime = 0;
    lastSnapServerNow = 0;
    lastSnapTick = -1;
    mpMapIdx = -1;
    mpVel.set(0, 0, 0);
    for (let i = 0; i < 8; i++) remoteNetState[i] = undefined;
    for (let i = 0; i < 8; i++) remoteHistory[i] = undefined;
    window.__TA_MP_SEND_FIRE = function () {};
    if (typeof window.refreshMenuProfileName === 'function') window.refreshMenuProfileName();
    for (let i = 0; i < remoteMeshes.length; i++) {
      if (remoteMeshes[i]) {
        scene.remove(remoteMeshes[i]);
        remoteMeshes[i].traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach(m => m && m.dispose());
          }
        });
        remoteMeshes[i] = null;
      }
    }
  };

  window.__TA_MP_SEND_FIRE = function (aim) {
    if (!aim || !ws || ws.readyState !== 1 || mpSlot < 0) return;
    ws.send(
      JSON.stringify({
        t: 'fire',
        sdx: aim.sdx,
        sdy: aim.sdy,
        sdz: aim.sdz,
        sox: aim.sox,
        soy: aim.soy,
        soz: aim.soz,
          rttMs: Math.round(rttEma * 1000),
      })
    );
  };
})();
