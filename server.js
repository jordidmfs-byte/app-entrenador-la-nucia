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

const apiHandler = require('./api/index.js');

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
    apiHandler(req, res);
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
