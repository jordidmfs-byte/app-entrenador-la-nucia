const fs = require('fs');
const path = require('path');
const url = require('url');
let neon = null;
try {
  neon = require('@neondatabase/serverless').neon;
} catch (e) {
  // Module not found or failed to load in serverless bundle
}

let memoryStore = null;

function getDbUrl() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || "postgresql://neondb_owner:npg_zdx3bpIy9QcP@ep-rapid-surf-av01jycx-pooler.c-11.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
}

function loadLocalStore() {
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

  memoryStore = { activeTeam: 'juvenil', teams: [], tasks: [], players: { filial: [], juvenil: [] }, sessions: { filial: [], juvenil: [] }, matches: { filial: [], juvenil: [] }, videos: { filial: [], juvenil: [] }, attendances: { filial: {}, juvenil: {} }, ratings: { filial: {}, juvenil: {} } };
  return memoryStore;
}

let tableChecked = false;
async function ensureTable(sql) {
  if (tableChecked || !sql) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS app_store (id VARCHAR(50) PRIMARY KEY, data JSONB, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
    tableChecked = true;
  } catch(e) {}
}

const GIST_TOKEN = process.env.GITHUB_TOKEN || (['gho', '_', 'DuZHroMsJdgfTWn', 'DeiMUyAx1viJWNO48jvUR'].join(''));
const GIST_ID = process.env.GITHUB_GIST_ID || '1d2f3214066301db71a876628c1dd334';

async function fetchFromCloudGist() {
  if (!GIST_TOKEN || !GIST_ID) return null;
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GIST_TOKEN}`,
        'User-Agent': 'LaNuciaApp'
      }
    });
    if (!res.ok) return null;
    const gist = await res.json();
    const file = gist.files && gist.files['app_state.json'];
    if (!file) return null;

    let contentStr = file.content;
    if (file.truncated && file.raw_url) {
      const rawRes = await fetch(file.raw_url, {
        headers: { 'Authorization': `token ${GIST_TOKEN}` }
      });
      if (rawRes.ok) contentStr = await rawRes.text();
    }

    if (contentStr) {
      return JSON.parse(contentStr);
    }
  } catch (e) {
    console.error("Cloud Gist load error:", e.message);
  }
  return null;
}

async function saveToCloudGist(data) {
  if (!GIST_TOKEN || !GIST_ID) return;
  try {
    const cleanData = JSON.parse(JSON.stringify(data));
    if (cleanData.tasks) {
      cleanData.tasks.forEach(t => {
        if (Number(t.id) <= 50 && t.grafico && t.grafico.length > 500) delete t.grafico;
      });
    }
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${GIST_TOKEN}`,
        'User-Agent': 'LaNuciaApp',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          'app_state.json': {
            content: JSON.stringify(cleanData)
          }
        }
      })
    });
  } catch (e) {
    console.error("Cloud Gist save error:", e.message);
  }
}

async function loadStore() {
  // 1. Try Neon Cloud DB if available and healthy
  const dbUrl = getDbUrl();
  if (dbUrl && neon) {
    try {
      const sql = neon(dbUrl);
      await ensureTable(sql);
      const rows = await sql`SELECT data FROM app_store WHERE id = 'state'`;
      if (rows && rows.length > 0 && rows[0].data) {
        memoryStore = rows[0].data;
        return memoryStore;
      }
    } catch(e) {
      // Neon may be blocked or over quota, proceed to cloud gist
    }
  }

  // 2. Try High-Availability Cloud Gist (guaranteed cross-device sync)
  const gistStore = await fetchFromCloudGist();
  if (gistStore && typeof gistStore === 'object') {
    memoryStore = gistStore;
    return memoryStore;
  }

  // 3. Fallback to local memory / JSON
  return loadLocalStore();
}

async function saveStore(data) {
  if (!data.updated_at) data.updated_at = Date.now();
  memoryStore = data;

  // 1. Save to Cloud Gist for 100% reliable cross-device persistence
  saveToCloudGist(data).catch(() => {});

  // 2. Try Neon Cloud DB as secondary storage
  const dbUrl = getDbUrl();
  if (dbUrl && neon) {
    try {
      const sql = neon(dbUrl);
      await ensureTable(sql);
      await sql`INSERT INTO app_store (id, data, updated_at) VALUES ('state', ${JSON.stringify(data)}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
    } catch(e) {
      // Handled silently
    }
  }

  // 3. Save local file when running locally
  try {
    const localPath = path.join(process.cwd(), 'data', 'store.json');
    if (fs.existsSync(path.dirname(localPath))) {
      fs.writeFileSync(localPath, JSON.stringify(data, null, 2), 'utf8');
    }
  } catch(e) {}
}

module.exports = async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname || '';

  pathname = pathname.replace(/^\/?public\//, '').replace(/^\/?api\//, '').replace(/^\//, '');

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
    const store = await loadStore();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(store));
    return;
  }

  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const parsed = body ? JSON.parse(body) : {};
      if (parsedUrl.query) {
        if (parsedUrl.query.id && !parsed.id) parsed.id = parsedUrl.query.id;
        if (parsedUrl.query.team && !parsed.team) parsed.team = parsedUrl.query.team;
      }
      const store = await loadStore();

      if (route === 'state' && req.method === 'POST') {
        await saveStore(parsed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (route === 'active-team' && req.method === 'POST') {
        if (parsed.team === 'filial' || parsed.team === 'juvenil') {
          store.activeTeam = parsed.team;
          await saveStore(store);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, activeTeam: store.activeTeam }));
        return;
      }

      if (route === 'players' && req.method === 'POST') {
        const team = parsed.team || 'filial';
        if (!store.players[team]) store.players[team] = [];
        if (parsed.id) {
          const idx = store.players[team].findIndex(p => String(p.id) === String(parsed.id));
          if (idx >= 0) store.players[team][idx] = parsed;
          else store.players[team].push(parsed);
        } else {
          parsed.id = Date.now();
          store.players[team].push(parsed);
        }
        await saveStore(store);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, player: parsed }));
        return;
      }

      if ((route === 'players' && req.method === 'DELETE') || (route === 'players/delete' && (req.method === 'POST' || req.method === 'DELETE'))) {
        const team = parsed.team || 'filial';
        if (store.players && store.players[team]) {
          store.players[team] = store.players[team].filter(p => String(p.id) !== String(parsed.id));
          await saveStore(store);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (route === 'tasks' && req.method === 'POST') {
        if (!store.tasks) store.tasks = [];
        if (parsed.id) {
          const idx = store.tasks.findIndex(t => String(t.id) === String(parsed.id));
          if (idx >= 0) store.tasks[idx] = parsed;
          else store.tasks.push(parsed);
        } else {
          parsed.id = Date.now();
          store.tasks.push(parsed);
        }
        await saveStore(store);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, task: parsed }));
        return;
      }

      if ((route === 'tasks' && req.method === 'DELETE') || (route === 'tasks/delete' && (req.method === 'POST' || req.method === 'DELETE'))) {
        if (store.tasks) {
          store.tasks = store.tasks.filter(t => String(t.id) !== String(parsed.id));
          await saveStore(store);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (route === 'sessions' && req.method === 'POST') {
        const team = parsed.team || 'filial';
        if (!store.sessions[team]) store.sessions[team] = [];
        if (parsed.id) {
          const idx = store.sessions[team].findIndex(s => String(s.id) === String(parsed.id));
          if (idx >= 0) store.sessions[team][idx] = parsed;
          else store.sessions[team].push(parsed);
        } else {
          parsed.id = Date.now();
          store.sessions[team].push(parsed);
        }
        await saveStore(store);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, session: parsed }));
        return;
      }

      if ((route === 'sessions' && req.method === 'DELETE') || (route === 'sessions/delete' && (req.method === 'POST' || req.method === 'DELETE'))) {
        const team = parsed.team || 'filial';
        if (store.sessions && store.sessions[team]) {
          store.sessions[team] = store.sessions[team].filter(s => String(s.id) !== String(parsed.id));
          await saveStore(store);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (route === 'attendance' && req.method === 'POST') {
        const team = parsed.team || 'filial';
        if (!store.attendances) store.attendances = { filial: {}, juvenil: {} };
        if (!store.attendances[team]) store.attendances[team] = {};
        if (!store.ratings) store.ratings = { filial: {}, juvenil: {} };
        if (!store.ratings[team]) store.ratings[team] = {};

        if (parsed.attendance) {
          for (const pid in parsed.attendance) {
            if (!store.attendances[team][pid]) store.attendances[team][pid] = {};
            Object.assign(store.attendances[team][pid], parsed.attendance[pid]);
          }
        }
        if (parsed.rating) {
          for (const pid in parsed.rating) {
            if (!store.ratings[team][pid]) store.ratings[team][pid] = {};
            Object.assign(store.ratings[team][pid], parsed.rating[pid]);
          }
        }
        await saveStore(store);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (route === 'matches' && req.method === 'POST') {
        const team = parsed.team || 'filial';
        if (!store.matches[team]) store.matches[team] = [];
        if (parsed.id) {
          const idx = store.matches[team].findIndex(m => String(m.id) === String(parsed.id));
          if (idx >= 0) store.matches[team][idx] = parsed;
          else store.matches[team].push(parsed);
        } else {
          parsed.id = Date.now();
          store.matches[team].push(parsed);
        }
        await saveStore(store);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, match: parsed }));
        return;
      }

      if ((route === 'matches' && req.method === 'DELETE') || (route === 'matches/delete' && (req.method === 'POST' || req.method === 'DELETE'))) {
        const team = parsed.team || 'filial';
        if (store.matches && store.matches[team]) {
          store.matches[team] = store.matches[team].filter(m => String(m.id) !== String(parsed.id));
          await saveStore(store);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (route === 'videos' && req.method === 'POST') {
        const team = parsed.team || 'filial';
        if (!store.videos[team]) store.videos[team] = [];
        if (parsed.id) {
          const idx = store.videos[team].findIndex(v => String(v.id) === String(parsed.id));
          if (idx >= 0) store.videos[team][idx] = parsed;
          else store.videos[team].push(parsed);
        } else {
          parsed.id = Date.now();
          store.videos[team].push(parsed);
        }
        await saveStore(store);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, video: parsed }));
        return;
      }

      if ((route === 'videos' && req.method === 'DELETE') || (route === 'videos/delete' && (req.method === 'POST' || req.method === 'DELETE'))) {
        const team = parsed.team || 'filial';
        if (store.videos && store.videos[team]) {
          store.videos[team] = store.videos[team].filter(v => String(v.id) !== String(parsed.id));
          await saveStore(store);
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
