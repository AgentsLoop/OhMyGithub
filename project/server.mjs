import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)))
const dist = join(root, 'dist')
const hasDist = existsSync(join(dist, 'index.html'))
const base = hasDist ? dist : root

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

function parsePort() {
  const idx = process.argv.indexOf('--port')
  if (idx !== -1 && process.argv[idx + 1]) return Number(process.argv[idx + 1])
  const eq = process.argv.find(a => a.startsWith('--port='))
  if (eq) return Number(eq.split('=')[1])
  return Number(process.env.PORT || 3000)
}

const port = parsePort()

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    let pathname = decodeURIComponent(url.pathname)
    if (pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      return
    }
    if (pathname === '/') pathname = '/index.html'
    let filePath = join(base, pathname)
    // prevent traversal
    if (!filePath.startsWith(base)) {
      res.writeHead(403); res.end('Forbidden'); return
    }
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, 'index.html')
    }
    if (!existsSync(filePath)) {
      // SPA fallback to index.html
      filePath = join(base, 'index.html')
    }
    const ext = extname(filePath).toLowerCase()
    const data = readFileSync(filePath)
    res.writeHead(200, { 'content-type': mime[ext] || 'application/octet-stream', 'cache-control': 'no-cache' })
    res.end(data)
  } catch (e) {
    res.writeHead(500); res.end('Error: ' + e.message)
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Tidepool Tangle server listening on http://0.0.0.0:${port} (base=${base})`)
})
