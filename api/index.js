const fs = require('fs');
const path = require('path');
const url = require('url');

let memoryStore = null;

function loadStore() {
  if (memoryStore) return memoryStore;
  const possiblePaths = [
    path.join(__dirname, '..', 'data', 'store.json'),
    path.join(process.cwd(), 'data', 'store.json'),
    path.join(__dirname, 'store.json')
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        memoryStore = JSON.parse(fs.readFileSync(p, 'utf8'));
        return memoryStore;
      }
    } catch (e) {}
  }

  memoryStore = { activeTeam: 'filial', teams: [], tasks: [], players: { filial: [], juvenil: [] }, sessions: { filial: [], juvenil: [] }, matches: { filial: [], juvenil: [] }, videos: { filial: [], juvenil: [] }, attendances: { filial: {}, juvenil: {} }, ratings: { filial: {}, juvenil: {} } };
  return memoryStore;
}

function saveStore(data) {
  memoryStore = data;
}

module.exports = (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname || '';

  // Clean pathname
  pathname = pathname.replace(/^\/api\//, '').replace(/^\//, '');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const route = pathname;

  if (route === 'share-url' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: '' }));
    return;
  }

  if (route === 'state' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadStore()));
    return;
  }

  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    try {
      const parsed = body ? JSON.parse(body) : {};
      const store = loadStore();

      if (route === 'active-team' && req.method === 'POST') {
        if (parsed.team === 'filial' || parsed.team === 'juvenil') {
          store.activeTeam = parsed.team;
          saveStore(store);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, activeTeam: store.activeTeam }));
        return;
      }

      if (route === 'players' && req.method === 'POST') {
        const team = parsed.team || 'filial';
        if (!store.players[team]) store.players[team] = [];
        if (parsed.id) {
          const idx = store.players[team].findIndex(p => p.id === parsed.id);
          if (idx >= 0) store.players[team][idx] = parsed;
          else store.players[team].push(parsed);
        } else {
          parsed.id = Date.now();
          store.players[team].push(parsed);
        }
        saveStore(store);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, player: parsed }));
        return;
      }

      if (route === 'players/delete' && req.method === 'POST') {
        const team = parsed.team || 'filial';
        if (store.players[team]) {
          store.players[team] = store.players[team].filter(p => p.id !== parsed.id);
          saveStore(store);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (route === 'tasks' && req.method === 'POST') {
        if (!store.tasks) store.tasks = [];
        if (parsed.id) {
          const idx = store.tasks.findIndex(t => t.id === parsed.id);
          if (idx >= 0) store.tasks[idx] = parsed;
          else store.tasks.push(parsed);
        } else {
          parsed.id = Date.now();
          store.tasks.push(parsed);
        }
        saveStore(store);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, task: parsed }));
        return;
      }

      if (route === 'tasks/delete' && req.method === 'POST') {
        if (store.tasks) {
          store.tasks = store.tasks.filter(t => t.id !== parsed.id);
          saveStore(store);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (route === 'sessions' && req.method === 'POST') {
        const team = parsed.team || 'filial';
        if (!store.sessions[team]) store.sessions[team] = [];
        if (parsed.id) {
          const idx = store.sessions[team].findIndex(s => s.id === parsed.id);
          if (idx >= 0) store.sessions[team][idx] = parsed;
          else store.sessions[team].push(parsed);
        } else {
          parsed.id = Date.now();
          store.sessions[team].push(parsed);
        }
        saveStore(store);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, session: parsed }));
        return;
      }

      if (route === 'sessions/delete' && req.method === 'POST') {
        const team = parsed.team || 'filial';
        if (store.sessions[team]) {
          store.sessions[team] = store.sessions[team].filter(s => s.id !== parsed.id);
          saveStore(store);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (route === 'attendance' && req.method === 'POST') {
        const team = parsed.team || 'filial';
        if (!store.attendances[team]) store.attendances[team] = {};
        if (parsed.date) {
          store.attendances[team][parsed.date] = parsed.records || {};
          saveStore(store);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (route === 'matches' && req.method === 'POST') {
        const team = parsed.team || 'filial';
        if (!store.matches[team]) store.matches[team] = [];
        if (parsed.id) {
          const idx = store.matches[team].findIndex(m => m.id === parsed.id);
          if (idx >= 0) store.matches[team][idx] = parsed;
          else store.matches[team].push(parsed);
        } else {
          parsed.id = Date.now();
          store.matches[team].push(parsed);
        }
        saveStore(store);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, match: parsed }));
        return;
      }

      if (route === 'matches/delete' && req.method === 'POST') {
        const team = parsed.team || 'filial';
        if (store.matches[team]) {
          store.matches[team] = store.matches[team].filter(m => m.id !== parsed.id);
          saveStore(store);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (route === 'videos' && req.method === 'POST') {
        const team = parsed.team || 'filial';
        if (!store.videos[team]) store.videos[team] = [];
        if (parsed.id) {
          const idx = store.videos[team].findIndex(v => v.id === parsed.id);
          if (idx >= 0) store.videos[team][idx] = parsed;
          else store.videos[team].push(parsed);
        } else {
          parsed.id = Date.now();
          store.videos[team].push(parsed);
        }
        saveStore(store);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, video: parsed }));
        return;
      }

      if (route === 'videos/delete' && req.method === 'POST') {
        const team = parsed.team || 'filial';
        if (store.videos[team]) {
          store.videos[team] = store.videos[team].filter(v => v.id !== parsed.id);
          saveStore(store);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    } catch(err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};
