import { SessionRecovery } from './session-recovery.mjs'
import { registerRun } from './run-record.mjs'
import { createServer, request as httpRequest } from 'node:http'
import { connect } from 'node:net'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Serialize checkpoint/validation workers. Invalidate before aborting: a late
// child result must never become current while a new main message is starting.
export class Lifecycle {
  constructor({ save, deploy, status = () => {} }) { Object.assign(this, { save, deploy, status }); this.generation = 0; this.active = null; this.lastMessage = ''; this.stopping = false }
  async busy() {
    const generation = ++this.generation
    const active = this.active
    active?.controller.abort()
    if (generation === this.generation) await this.status('working', generation)
    if (active) await active.promise.catch(() => {})
    return generation
  }
  async complete(messageID) {
    if (this.stopping || !messageID || messageID === this.lastMessage) return
    this.lastMessage = messageID
    let generation
    try { generation = await this.busy() }
    catch (error) {
      if (this.lastMessage === messageID) this.lastMessage = ''
      await Promise.resolve(this.status('failed', this.generation, error.message)).catch(() => {})
      throw error
    }
    if (generation !== this.generation || this.stopping) return
    const controller = new AbortController()
    const current = () => !controller.signal.aborted && generation === this.generation && !this.stopping
    const promise = (async () => {
      await this.status('saving', generation)
      const checkpoint = await this.save(controller.signal)
      if (!current() || !checkpoint) return
      await this.status('deploying', generation)
      await this.deploy({ checkpoint, messageID, generation, signal: controller.signal, current })
      if (current()) await this.status('ready', generation)
    })().catch(async error => { if (current()) await Promise.resolve(this.status('failed', generation, error.message)).catch(() => {}) })
    this.active = { controller, promise }
    await promise
    if (this.active?.promise === promise) this.active = null
  }
  async shutdown() { this.stopping = true; await this.busy(); await this.save(undefined, true) }
}

export function child(file, args, { signal, ...options } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const proc = spawn(file, args, { stdio: 'inherit', detached: process.platform !== 'win32', ...options })
    let forced
    const kill = signame => { try { process.kill(-proc.pid, signame) } catch { proc.kill(signame) } }
    const abort = () => { kill('SIGTERM'); forced = setTimeout(() => kill('SIGKILL'), 5000) }
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    proc.once('error', reject)
    proc.once('close', code => {
      clearTimeout(forced); signal?.removeEventListener('abort', abort)
      process.stderr.write(`[timing] ${file}: ${Date.now() - started} ms\n`)
      if (signal?.aborted) reject(new Error('Cancelled'))
      else if (code !== 0) reject(Object.assign(new Error(`${file} exited ${code}`), { exitCode: code }))
      else resolve()
    })
  })
}

async function serve() {
  const env = process.env, directory = env.OPENCODE_WEB_DIR
  const upstream = `http://127.0.0.1:${env.OPENCODE_WEB_PORT}`
  const mainID = () => { try { return readFileSync(join(directory, 'checkpoint-session-id'), 'utf8').trim() } catch { return '' } }
  const api = async (path, options = {}) => {
    const response = await fetch(`${upstream}${path}`, { ...options, headers: { 'x-opencode-directory': env.PROJECT_DIR, 'content-type': 'application/json' }, signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`OpenCode HTTP ${response.status}`)
    return response.status === 204 ? undefined : response.json()
  }
  const lifecycle = new Lifecycle({
    save: async (signal, interrupted) => {
      if (!mainID()) return null
      await child(process.execPath, [join(env.RUNTIME_DIR, 'scripts/session-checkpoint.mjs'), interrupted ? 'shutdown' : 'save'], { signal })
      return JSON.parse(readFileSync(join(directory, 'checkpoint-state.json'), 'utf8'))
    },
    deploy: async ({ checkpoint, messageID, generation, signal }) => {
      const appURL = readFileSync(join(directory, 'app-url'), 'utf8').trim()
      if (!appURL) throw new Error('Preview failed: app tunnel unavailable')
      await child(process.execPath, [join(env.RUNTIME_DIR, 'scripts/session-deploy.mjs')], { signal, env: { ...env, APP_URL: appURL, CHECKPOINT_COMMIT: checkpoint.commit, CHECKPOINT_GENERATION: checkpoint.generation, MAIN_MESSAGE_ID: messageID, DEPLOYMENT_GENERATION: String(generation) } })
    },
    status: async (state, generation, error = '') => {
      writeFileSync(join(directory, 'deployment-status.json'), JSON.stringify({ state, generation, error, updated_at: new Date().toISOString() }))
      if (state === 'working' && existsSync(join(directory, 'active-validation.json'))) {
        const active = JSON.parse(readFileSync(join(directory, 'active-validation.json'), 'utf8'))
        const response = await fetch(`${upstream}/session/${active.id}/abort`, { method: 'POST', headers: { 'x-opencode-directory': active.directory }, signal: AbortSignal.timeout(30000) })
        if (!response.ok) throw new Error('Could not stop validation. Retry the message.')
        rmSync(join(directory, 'active-validation.json'), { force: true })
      }
      if (!lifecycle.stopping) {
        const response = await fetch(`${env.OMGITHUB_ORIGIN || 'https://omgithub.com'}/api/github/${env.GITHUB_REPOSITORY}/issues/${env.TRIGGER_ISSUE_NUMBER}/deployment`, {
          method: 'POST', headers: { authorization: `Bearer ${env.GH_TOKEN || env.GITHUB_TOKEN}`, 'x-omgithub-run': env.GITHUB_RUN_ID, 'x-omgithub-attempt': env.GITHUB_RUN_ATTEMPT || '1', 'x-omgithub-generation': String(generation), 'x-omgithub-state': state, 'x-omgithub-error': encodeURIComponent(error).slice(0, 1000) }, signal: AbortSignal.timeout(30000)
        })
        if (!response.ok) throw new Error(`Deployment registration HTTP ${response.status}`)
        await heartbeat()
      }
    }
  })
  try { lifecycle.generation = Number(JSON.parse(readFileSync(join(directory, 'deployment-status.json'), 'utf8')).generation) || 0 } catch {}
  const snapshot = async id => {
    const states = await api('/session/status')
    return { id, busy: Boolean(states[id]?.type && states[id].type !== 'idle'), messages: await api(`/session/${id}/message`) }
  }
  const recovery = new SessionRecovery({ snapshot, send: (id, body) => api(`/session/${id}/prompt_async`, { method: 'POST', body: JSON.stringify(body) }) })
  let messageGate = Promise.resolve()
  const proxy = createServer(async (req, res) => {
    try {
      if (req.url === '/omgithub/heartbeat') { await heartbeat(); res.end('ok'); return }
      if (req.url === '/omgithub/reconcile') { await reconcile(); res.end('ok'); return }
      if (req.url === '/omgithub/deployment') { res.setHeader('content-type', 'application/json'); res.end(readFileSync(join(directory, 'deployment-status.json'), 'utf8')); return }
      if (req.method === 'POST' && req.url.split('?')[0] === `/session/${mainID()}/abort`) recovery.cancel()
      const match = req.url.match(/^\/session\/([^/?]+)\/(message|prompt_async|command)(?:\?|$)/)
      if (req.method === 'POST' && match?.[1] === mainID()) {
        recovery.cancel(true)
        const gate = messageGate.then(() => lifecycle.busy())
        messageGate = gate.catch(() => {})
        await gate
      }
      let targetURL = `${upstream}${req.url}`
      if (req.url.startsWith('/omgithub/files/')) {
        const config = readFileSync(join(directory, 'nginx/nginx.conf'), 'utf8')
        const port = config.match(/listen\s+127\.0\.0\.1:(\d+)/)?.[1]
        if (!port) throw new Error('File server unavailable')
        targetURL = `http://127.0.0.1:${port}/${req.url.slice('/omgithub/files/'.length)}`
      }
      const target = httpRequest(targetURL, { method: req.method, headers: req.headers }, reply => {
        if (req.url.startsWith('/omgithub/files/') && reply.headers.location) {
          const location = new URL(reply.headers.location, targetURL)
          reply.headers.location = '/omgithub/files' + location.pathname + location.search
        }
        res.writeHead(reply.statusCode, reply.headers); reply.pipe(res)
      })
      target.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end() })
      req.pipe(target)
    } catch { res.writeHead(503); res.end('Deployment controller unavailable') }
  })
  proxy.on('upgrade', (req, socket, head) => {
    const remote = connect(Number(env.OPENCODE_WEB_PORT), '127.0.0.1', () => {
      remote.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${Object.entries(req.headers).map(([k,v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`)
      remote.write(head); socket.pipe(remote); remote.pipe(socket)
    })
    remote.on('error', () => socket.destroy()); socket.on('error', () => remote.destroy())
  })
  let registration = Promise.resolve()
  const heartbeat = state => {
    registration = registration.then(() => registerRun(env, state)).catch(error => console.error(error.message))
    return registration
  }
  await new Promise(resolve => proxy.listen(Number(env.OPENCODE_CONTROL_PORT), '127.0.0.1', resolve))
  await heartbeat()
  const heartbeatTimer = setInterval(() => void heartbeat(), 30000)
  let stopping = false
  for (const name of ['SIGTERM', 'SIGINT']) process.once(name, () => {
    stopping = true
    recovery.cancel()
    clearInterval(heartbeatTimer)
    lifecycle.shutdown().catch(console.error).finally(async () => { await heartbeat('ended'); process.exit() })
  })
  async function reconcile() {
    const id = mainID()
    if (!id || lifecycle.stopping) return
    const current = await snapshot(id)
    recovery.observe(current)
    if (current.busy) return
    const messages = current.messages
    const last = messages.at(-1)?.info
    if (last?.role === 'assistant' && last.time?.completed && !last.error && last.finish !== 'tool-calls') void lifecycle.complete(last.id).catch(console.error)
  }
  // Reconnect the event stream, not a checkpoint timer. Reconcile missed idle
  // events after reconnecting so the first quick response is not lost.
  while (!stopping) {
    try {
      const response = await fetch(`${upstream}/event`, { headers: { 'x-opencode-directory': env.PROJECT_DIR } })
      if (!response.ok || !response.body) throw new Error('Event stream unavailable')
      await reconcile()
      let buffer = ''
      for await (const chunk of response.body) {
        buffer += Buffer.from(chunk).toString('utf8')
        let end
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2)
          const data = frame.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n')
          if (!data) continue
          const event = JSON.parse(data), id = event.properties?.sessionID
          if (id !== mainID()) continue
          if (event.type === 'session.status' && event.properties.status?.type === 'busy') { recovery.cancel(); void lifecycle.busy().catch(console.error) }
          if (event.type === 'session.idle' || (event.type === 'session.status' && event.properties.status?.type === 'idle')) await reconcile()
        }
      }
    } catch (error) { console.error(error.message) }
    if (!stopping) await new Promise(resolve => setTimeout(resolve, 1000))
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await serve()
