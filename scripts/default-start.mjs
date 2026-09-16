import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { resolve, join, extname } from 'node:path'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { child } from './session-lifecycle.mjs'

export function projectType(root) {
  if (existsSync(join(root, 'package.json'))) {
    const p = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    if (p.dependencies?.next || p.devDependencies?.next) throw new Error('Unsupported framework: customize start.sh and provide static deployment output.')
    if (p.dependencies?.vite || p.devDependencies?.vite) return 'vite'
    throw new Error('Unsupported package project: customize start.sh and deployment output.')
  }
  if (existsSync(join(root, 'index.html'))) return 'html'
  throw new Error('No generated index.html or supported package project.')
}
export async function start(root = process.cwd()) {
  const type = projectType(root)
  if (type === 'vite') {
    const stampDir = process.env.OPENCODE_WEB_DIR || join(root, 'node_modules', '.cache')
    mkdirSync(stampDir, { recursive: true })
    const stamp = join(stampDir, 'default-dependencies')
    const lock = join(root, 'package-lock.json')
    const hash = createHash('sha256').update(readFileSync(join(root, 'package.json'))).update(existsSync(lock) ? readFileSync(lock) : '').digest('hex')
    let old = ''
    try { old = readFileSync(stamp, 'utf8') } catch {}
    if (old !== hash || !existsSync(join(root, 'node_modules/vite'))) {
      await child('npm', [existsSync(lock) ? 'ci' : 'install', '--no-audit', '--no-fund'], { cwd: root })
      mkdirSync(stampDir, { recursive: true })
      const installedHash = createHash('sha256').update(readFileSync(join(root, 'package.json'))).update(existsSync(lock) ? readFileSync(lock) : '').digest('hex')
      writeFileSync(stamp, installedHash)
    }
    await child(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: root })
    root = join(root, 'dist')
  }
  if (!existsSync(join(root, 'index.html'))) throw new Error('Static deployment output must contain index.html.')
  const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.wasm':'application/wasm', '.glb':'model/gltf-binary' }
  const server = createServer((req, res) => {
    try {
      const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname))
      if (path !== resolve(root) && !path.startsWith(resolve(root) + '/')) { res.writeHead(404); res.end(); return }
      const file = statSync(path).isDirectory() ? join(path, 'index.html') : path
      res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.end(readFileSync(file))
    } catch { res.writeHead(404); res.end('Not found') }
  })
  server.listen(Number(process.env.PORT || 3000), '0.0.0.0')
  return server
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await start()
