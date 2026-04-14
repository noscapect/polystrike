'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ADMIN_USER = 'noscapect';
const ADMIN_PASS = 'WLli7VKY';
const SESSION_MS = 24 * 60 * 60 * 1000;
const sessions = new Map();

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => {
      d += c;
    });
    req.on('end', () => {
      try {
        resolve(d ? JSON.parse(d) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(obj));
}

function jsonPublic(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(obj));
}

function readAuth(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const exp = sessions.get(token);
  if (!exp || Date.now() > exp) {
    if (token) sessions.delete(token);
    return null;
  }
  return token;
}

/**
 * @returns {Promise<boolean>} true if request was handled
 */
function createAdminHandler(game, wss) {
  const adminHtml = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8');

  return async function handleAdmin(req, res) {
    const u = new URL(req.url, 'http://127.0.0.1');
    const p = u.pathname;
    if (req.method === 'OPTIONS' && (p === '/api/public/lobby' || p === '/api/public/servers')) {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return true;
    }

    if (p === '/api/public/lobby' && req.method === 'GET') {
      const snap = game.snapshot();
      jsonPublic(res, 200, {
        ok: true,
        mapIdx: snap.mapIdx || 0,
        roundTimer: snap.roundTimer,
        roundActive: snap.roundActive,
        intermission: snap.intermission,
        maxPlayers: game.entities.length,
        humans: snap.entities
          .filter(e => !e.isBot)
          .map(e => ({ slot: e.slot, name: e.name, kills: e.kills, deaths: e.deaths })),
      });
      return true;
    }

    if (p === '/api/public/servers' && req.method === 'GET') {
      const configured = (process.env.MP_SERVERS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const defaults = ['ws://localhost:8080'];
      const dedup = Array.from(new Set([...defaults, ...configured]));
      jsonPublic(res, 200, {
        ok: true,
        servers: dedup.map(url => ({ url })),
      });
      return true;
    }

    if (p === '/admin' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(adminHtml);
      return true;
    }

    if (p === '/api/admin/login' && req.method === 'POST') {
      let body;
      try {
        body = await parseBody(req);
      } catch (_) {
        json(res, 400, { ok: false, error: 'Invalid JSON' });
        return true;
      }
      if (body.username === ADMIN_USER && body.password === ADMIN_PASS) {
        const token = crypto.randomBytes(32).toString('hex');
        sessions.set(token, Date.now() + SESSION_MS);
        json(res, 200, { ok: true, token });
        return true;
      }
      json(res, 401, { ok: false, error: 'Invalid credentials' });
      return true;
    }

    if (p === '/api/admin/state' && req.method === 'GET') {
      if (!readAuth(req)) {
        json(res, 401, { ok: false, error: 'Unauthorized' });
        return true;
      }
      const snap = game.snapshot();
      json(res, 200, {
        ok: true,
        tick: game.tick,
        roundTimer: snap.roundTimer,
        roundActive: snap.roundActive,
        intermission: snap.intermission,
        connectedHumans: game.entities.filter(e => e.ws).length,
        wsClients: wss.clients.size,
        entities: snap.entities,
      });
      return true;
    }

    if (p === '/api/admin/kick' && req.method === 'POST') {
      if (!readAuth(req)) {
        json(res, 401, { ok: false, error: 'Unauthorized' });
        return true;
      }
      let body;
      try {
        body = await parseBody(req);
      } catch (_) {
        json(res, 400, { ok: false, error: 'Invalid JSON' });
        return true;
      }
      const slot = Number(body.slot);
      if (slot !== slot || slot < 0 || slot > 7) {
        json(res, 400, { ok: false, error: 'Bad slot' });
        return true;
      }
      json(res, 200, { ok: game.kickSlot(slot) });
      return true;
    }

    if (p === '/api/admin/end-round' && req.method === 'POST') {
      if (!readAuth(req)) {
        json(res, 401, { ok: false, error: 'Unauthorized' });
        return true;
      }
      json(res, 200, { ok: game.adminForceEndRound() });
      return true;
    }

    if (p === '/api/admin/add-time' && req.method === 'POST') {
      if (!readAuth(req)) {
        json(res, 401, { ok: false, error: 'Unauthorized' });
        return true;
      }
      let body;
      try {
        body = await parseBody(req);
      } catch (_) {
        json(res, 400, { ok: false });
        return true;
      }
      const sec = Number(body.seconds);
      if (!Number.isFinite(sec)) {
        json(res, 400, { ok: false, error: 'Bad seconds' });
        return true;
      }
      game.adminAddRoundTime(sec);
      json(res, 200, { ok: true });
      return true;
    }

    if (p === '/api/admin/teleport-all' && req.method === 'POST') {
      if (!readAuth(req)) {
        json(res, 401, { ok: false, error: 'Unauthorized' });
        return true;
      }
      game.adminTeleportAll();
      json(res, 200, { ok: true });
      return true;
    }

    if (p === '/api/admin/start-round' && req.method === 'POST') {
      if (!readAuth(req)) {
        json(res, 401, { ok: false, error: 'Unauthorized' });
        return true;
      }
      game.startRound();
      json(res, 200, { ok: true });
      return true;
    }

    return false;
  };
}

module.exports = { createAdminHandler };
