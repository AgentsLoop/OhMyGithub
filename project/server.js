import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function parsePort(){
  const args = process.argv.slice(2);
  const idx = args.indexOf('--port');
  if (idx !== -1 && args[idx+1]) return parseInt(args[idx+1],10);
  // support --port=3000
  const eq = args.find(a=>a.startsWith('--port='));
  if (eq) return parseInt(eq.split('=')[1],10);
  // fallback numeric arg
  const num = args.find(a=> /^\d+$/.test(a));
  if (num) return parseInt(num,10);
  if (process.env.PORT) return parseInt(process.env.PORT,10);
  return 3000;
}
const PORT = parsePort();

const MIME = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.ico':'image/x-icon'
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  // prevent directory traversal
  const safe = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(__dirname, safe);
  // if directory, serve index.html
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {}
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, {'Content-Type':'text/plain'});
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, {'Content-Type': MIME[ext] || 'application/octet-stream'});
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Snake server listening on http://0.0.0.0:${PORT}`);
});
