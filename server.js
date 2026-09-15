const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3050;
const STORE_PATH = path.join(__dirname, 'data', 'store.json');

function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (e) {
    console.error('Error loading store:', e);
    return { activeTeam: 'filial', teams: [], tasks: [], players: { filial: [], juvenil: [] }, sessions: { filial: [], juvenil: [] }, matches: { filial: [], juvenil: [] }, videos: { filial: [], juvenil: [] }, attendances: { filial: {}, juvenil: {} } };
  }
}

function saveStore(data) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving store:', e);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

let currentPublicShareUrl = 'https://lauren-routers-circuit-blocked.trycloudflare.com';

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (pathname.startsWith('/api/')) {
    const route = pathname.replace('/api/', '');

    if (route === 'share-url' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: currentPublicShareUrl }));
      return;
    }

    if (route === 'state' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(loadStore()));
      return;
    }

    if (route === 'active-team' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const store = loadStore();
          if (parsed.team === 'filial' || parsed.team === 'juvenil') {
            store.activeTeam = parsed.team;
            saveStore(store);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, activeTeam: store.activeTeam }));
        } catch(err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (route === 'players' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const team = payload.team || 'filial';
          const store = loadStore();
          if (!store.players[team]) store.players[team] = [];

          if (payload.id) {
            const idx = store.players[team].findIndex(p => p.id == payload.id);
            if (idx !== -1) store.players[team][idx] = { ...store.players[team][idx], ...payload };
          } else {
            payload.id = team[0] + '_' + Date.now();
            store.players[team].push(payload);
          }
          saveStore(store);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, players: store.players[team] }));
        } catch(err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (route === 'players' && req.method === 'DELETE') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const store = loadStore();
          if (store.players[parsed.team]) {
            store.players[parsed.team] = store.players[parsed.team].filter(p => p.id != parsed.id);
            saveStore(store);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, players: store.players[parsed.team] }));
        } catch(err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (route === 'tasks' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const store = loadStore();
          if (payload.id) {
            const idx = store.tasks.findIndex(t => t.id == payload.id);
            if (idx !== -1) store.tasks[idx] = { ...store.tasks[idx], ...payload };
          } else {
            const maxId = store.tasks.reduce((m, t) => Math.max(m, Number(t.id) || 0), 0);
            payload.id = maxId + 1;
            store.tasks.unshift(payload);
          }
          saveStore(store);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, tasks: store.tasks }));
        } catch(err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (route === 'tasks' && req.method === 'DELETE') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const store = loadStore();
          store.tasks = store.tasks.filter(t => t.id != parsed.id);
          saveStore(store);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, tasks: store.tasks }));
        } catch(err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (route === 'sessions' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const team = payload.team || 'filial';
          const store = loadStore();
          if (!store.sessions[team]) store.sessions[team] = [];

          if (payload.id) {
            const idx = store.sessions[team].findIndex(s => s.id == payload.id);
            if (idx !== -1) store.sessions[team][idx] = { ...store.sessions[team][idx], ...payload };
          } else {
            payload.id = 'sess_' + Date.now();
            store.sessions[team].unshift(payload);
          }
          saveStore(store);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, session: payload }));
        } catch(err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (route === 'sessions' && req.method === 'DELETE') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const store = loadStore();
          if (store.sessions[parsed.team]) {
            store.sessions[parsed.team] = store.sessions[parsed.team].filter(s => s.id != parsed.id);
            saveStore(store);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch(err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (route === 'attendance' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const team = payload.team || 'filial';
          const store = loadStore();
          if (!store.attendances[team]) store.attendances[team] = {};
          if (!store.ratings) store.ratings = { filial: {}, juvenil: {} };
          if (!store.ratings[team]) store.ratings[team] = {};

          if (payload.attendance) {
            for (const pid in payload.attendance) {
              if (!store.attendances[team][pid]) store.attendances[team][pid] = {};
              for (const date in payload.attendance[pid]) {
                const val = payload.attendance[pid][date];
                if (val) store.attendances[team][pid][date] = val;
                else delete store.attendances[team][pid][date];
              }
            }
          }

          if (payload.rating) {
            for (const pid in payload.rating) {
              if (!store.ratings[team][pid]) store.ratings[team][pid] = {};
              for (const date in payload.rating[pid]) {
                const rVal = payload.rating[pid][date];
                if (rVal) store.ratings[team][pid][date] = parseInt(rVal);
                else delete store.ratings[team][pid][date];
              }
            }
          }

          saveStore(store);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, attendances: store.attendances[team], ratings: store.ratings[team] }));
        } catch(err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (route === 'matches' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const team = payload.team || 'filial';
          const store = loadStore();
          if (!store.matches[team]) store.matches[team] = [];

          if (payload.id) {
            const idx = store.matches[team].findIndex(m => m.id == payload.id);
            if (idx !== -1) store.matches[team][idx] = { ...store.matches[team][idx], ...payload };
          } else {
            payload.id = 'match_' + Date.now();
            store.matches[team].unshift(payload);
          }
          saveStore(store);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, match: payload }));
        } catch(err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (route === 'matches' && req.method === 'DELETE') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const store = loadStore();
          if (store.matches[parsed.team]) {
            store.matches[parsed.team] = store.matches[parsed.team].filter(m => m.id != parsed.id);
            saveStore(store);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch(err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (route === 'videos' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const team = payload.team || 'filial';
          const store = loadStore();
          if (!store.videos[team]) store.videos[team] = [];
          payload.id = 'vid_' + Date.now();
          payload.fecha = payload.fecha || new Date().toISOString().split('T')[0];
          store.videos[team].unshift(payload);
          saveStore(store);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, video: payload }));
        } catch(err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (route === 'videos' && req.method === 'DELETE') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const store = loadStore();
          if (store.videos[parsed.team]) {
            store.videos[parsed.team] = store.videos[parsed.team].filter(v => v.id != parsed.id);
            saveStore(store);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch(err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
    return;
  }

  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(__dirname, 'public', 'index.html'), (err2, content2) => {
          if (err2) {
            res.writeHead(404);
            res.end('404 Not Found');
          } else {
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=UTF-8',
              'Content-Disposition': 'inline',
              'X-Content-Type-Options': 'nosniff'
            });
            res.end(content2, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log('App Entrenador La Nucía FS online on http://localhost:' + PORT);
});
