const http = require('http');
const fs = require('fs');
const path = require('path');

function getPort() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--port' && args[i+1]) {
      const p = parseInt(args[i+1], 10);
      if (!isNaN(p)) return p;
    }
    if (a.startsWith('--port=')) {
      const p = parseInt(a.split('=')[1], 10);
      if (!isNaN(p)) return p;
    }
    // plain numeric arg
    if (/^\d+$/.test(a)) {
      return parseInt(a, 10);
    }
  }
  if (process.env.PORT) {
    const p = parseInt(process.env.PORT, 10);
    if (!isNaN(p)) return p;
  }
  return 3000;
}

const PORT = getPort();
const ROOT = __dirname;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0].split('#')[0];
  // decode
  try { urlPath = decodeURIComponent(urlPath); } catch(e) {}
  // normalize
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  let filePath = path.join(ROOT, urlPath);

  // Prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // If directory, serve index.html inside it
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch(e) {
    // file doesn't exist, try as is
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // fallback to index.html for SPA? but better 404, except try root index
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found: ' + urlPath);
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const ct = mime[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving ${ROOT} on http://0.0.0.0:${PORT}`);
});
