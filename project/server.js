import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPort(){
  const argv = process.argv;
  const idx = argv.indexOf('--port');
  if(idx !== -1 && argv[idx+1]) {
    const p = parseInt(argv[idx+1], 10);
    if(!isNaN(p)) return p;
  }
  // also check --port=3000 form
  for(const a of argv){
    const m = a.match(/^--port[= ](\d+)$/);
    if(m) return parseInt(m[1],10);
  }
  if(process.env.APP_PORT) return parseInt(process.env.APP_PORT,10);
  if(process.env.PORT) return parseInt(process.env.PORT,10);
  return 3000;
}

const PORT = getPort();
const DIST = path.join(__dirname, 'dist');
const ROOT = __dirname;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8'
};

function contentType(p){
  const ext = path.extname(p).toLowerCase();
  return mime[ext] || 'application/octet-stream';
}

function hasDist(){
  try { return fs.existsSync(path.join(DIST, 'index.html')); } catch{ return false; }
}

const useDist = hasDist();
const baseDir = useDist ? DIST : ROOT;
console.log(`[server] ${useDist ? 'serving dist' : 'serving project root'} on 0.0.0.0:${PORT} (dist ${useDist?'found':'missing'})`);

const server = http.createServer((req, res) => {
  // CORS and no host check — allow any Host (trycloudflare)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if(req.method === 'OPTIONS'){
    res.writeHead(204);
    res.end();
    return;
  }
  // Strip query
  let urlPath = req.url.split('?')[0];
  // Normalize
  if(urlPath === '/') urlPath = '/index.html';
  // Prevent directory traversal
  urlPath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(baseDir, urlPath);
  // If request is for /@vite/client or similar and we're serving dist, rewrite to not found -> fallback
  // For dev fallback when dist missing, try ROOT then fallback to index.html
  if(!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()){
    // Try ROOT as fallback if baseDir is DIST and file not found and it's not asset
    if(useDist){
      const alt = path.join(ROOT, urlPath);
      if(fs.existsSync(alt) && !fs.statSync(alt).isDirectory()){
        filePath = alt;
      } else {
        // SPA fallback: serve index.html for unknown routes (but not for assets)
        if(!urlPath.startsWith('/assets/') && !urlPath.includes('.')){
          filePath = path.join(baseDir, 'index.html');
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }
      }
    } else {
      // serving ROOT, fallback to index.html for SPA
      if(!urlPath.includes('.')){
        filePath = path.join(ROOT, 'index.html');
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
    }
  }
  // Ensure file exists now
  if(!fs.existsSync(filePath)){
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType(filePath), 'Cache-Control': 'no-cache' });
    if(req.method === 'HEAD'){
      res.end();
    } else {
      res.end(data);
    }
  } catch(e){
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] listening on http://0.0.0.0:${PORT} (http://localhost:${PORT})`);
});
server.on('error', (err)=>{
  console.error('[server] error', err);
  process.exit(1);
});
