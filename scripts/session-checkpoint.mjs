import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const env = process.env
const digest = value => createHash('sha256').update(value).digest('hex')
export function command(file, args, options = {}) {
  const start = Date.now()
  try { return execFileSync(file, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'], ...options }).trim() }
  catch (error) { throw new Error(`${file} ${args[0] || ''} failed (exit ${error.status ?? 'timeout'}).`) }
  finally { process.stderr.write(`[timing] ${file} ${args[0] || ''}: ${Date.now() - start} ms\n`) }
}
export function parseResume(request) {
  const matches = [...String(request).matchAll(/<!-- omgithub-resume:v1 (\{[^\n]*\}) -->/g)]
  if (!matches.length) {
    if (/<!--\s*omgithub-resume:/i.test(request)) throw new Error('Invalid resume request.')
    return null
  }
  if (matches.length !== 1) throw new Error('Ambiguous resume request.')
  const source = JSON.parse(matches[0][1])
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source.source_repository) || !Number.isSafeInteger(source.source_issue) || source.source_issue < 1 ||
      !new RegExp(`^opencode-checkpoint-${source.source_issue}-[1-9]\\d*-\\d+$`).test(source.checkpoint_tag)) throw new Error('Invalid checkpoint source.')
  return { ...source, prompt: String(request).replace(matches[0][0], '').replace(/<!-- omgithub-resume-request:[a-f0-9]+ -->/g, '').replace(/^Continue from https:\/\/github\.com\/[^\n]+\n?/gm, '').trim() }
}
export function validateCheckpoint(c, source) {
  if (!(c?.version === 1 && c.repository?.toLowerCase() === source.source_repository.toLowerCase() && c.issue_number === source.source_issue &&
      Number.isSafeInteger(c.run_id) && c.run_id > 0 && /^[a-f0-9]{40}$/.test(c.commit) && /^opencode-checkpoints\/[1-9]\d*$/.test(c.branch) &&
      typeof c.project_dir === 'string' && !c.project_dir.startsWith('/') && !c.project_dir.includes('\\') && !/[\r\n\0]/.test(c.project_dir) && !c.project_dir.split('/').includes('..') &&
      /^\d+\.\d+\.\d+$/.test(c.opencode_version) && c.public_history === true && /^ses_[a-zA-Z0-9]+$/.test(c.session?.info?.id || '') &&
      Array.isArray(c.session?.messages) && c.session.messages.length > 0 && c.session.messages.every(m => m.info?.id && ['user', 'assistant'].includes(m.info.role) && Array.isArray(m.parts)))) throw new Error('No complete saved session is available.')
  return c
}
export function redactSession(session, secrets = []) {
  function clean(value) {
    if (typeof value === 'string') {
      for (const secret of secrets.filter(s => typeof s === 'string' && s.length >= 8)) value = value.split(secret).join('[credential removed]')
      return value.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[private key removed]')
        .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/g, '[credential removed]')
    }
    if (Array.isArray(value)) return value.map(clean)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, /^(?:apiKey|api_key|access_token|refresh_token|password|authorization)$/i.test(k) ? '[credential removed]' : clean(v)]))
    return value
  }
  return clean(session)
}
const forbidden = /(^|\/)(?:\.env(?:\.[^/]*)?|auth\.json|credentials(?:\.json)?|node_modules|\.git|\.agents|\.agentsweb|\.omgithub-runtime|\.opencode-ssh|\.opencode-web|opencode-agentsweb-id_ed25519(?:\.pub)?)(\/|$)|(?:\.log|\.pid|\.pem|\.key)$/i
export function excludedPath(path) { return forbidden.test(path) || /(^|\/)\.opencode\/(?:goals|auth\.json)(\/|$)/.test(path) }

function api(path, args = []) { return command('gh', ['api', path, ...args]) }
function checkpointPath() { return join(env.RUNNER_TEMP, 'omgithub-restore-checkpoint.json') }
function setEnv(name, value) {
  const delimiter = `OMGHITHUB_${randomUUID().replaceAll('-', '')}`
  appendFileSync(env.GITHUB_ENV, `${name}<<${delimiter}\n${value}\n${delimiter}\n`)
}
export function prepare() {
  const source = parseResume(env.COMMENT_BODY || '')
  if (!source) return
  if (!source.prompt) throw new Error('Enter the next game change.')
  const repository = JSON.parse(api(`repos/${source.source_repository}`))
  if (repository.private) throw new Error('Only public checkpoints can be copied.')
  const release = JSON.parse(api(`repos/${source.source_repository}/releases/tags/${source.checkpoint_tag}`))
  const asset = release.assets?.find(a => a.name === 'checkpoint.json' && a.state === 'uploaded' && a.size > 0 && a.size <= 25 * 1024 * 1024)
  if (release.draft || !asset) throw new Error('No complete saved session is available.')
  const checkpoint = validateCheckpoint(JSON.parse(api(`repos/${source.source_repository}/releases/assets/${asset.id}`, ['-H', 'Accept: application/octet-stream'])), source)
  if (release.target_commitish !== checkpoint.commit || !source.checkpoint_tag.startsWith(`opencode-checkpoint-${source.source_issue}-${checkpoint.run_id}-`)) throw new Error('Checkpoint release does not match saved code.')
  command('git', ['fetch', '--no-tags', 'origin', checkpoint.commit], { cwd: env.GITHUB_WORKSPACE })
  // Preparation has already selected the compatible caller. Restore code before installing runtime-only files.
  command('git', ['checkout', '--detach', checkpoint.commit], { cwd: env.GITHUB_WORKSPACE })
  writeFileSync(checkpointPath(), JSON.stringify(checkpoint), { mode: 0o600 })
  setEnv('TARGET_SHA', checkpoint.commit)
  setEnv('PROJECT_PATH', checkpoint.project_dir || '.')
  setEnv('COMMENT_BODY', source.prompt)
  setEnv('RESUME_OPENCODE_VERSION', checkpoint.opencode_version)
  setEnv('RESUME_CHECKPOINT_FILE', checkpointPath())
}
export function restore() {
  if (!env.RESUME_CHECKPOINT_FILE) return
  const checkpoint = JSON.parse(readFileSync(env.RESUME_CHECKPOINT_FILE, 'utf8'))
  const binary = env.OPENCODE_BIN || join(env.HOME, '.opencode/bin/opencode')
  const version = command(binary, ['--version'])
  if (version !== checkpoint.opencode_version) throw new Error('Install the saved OpenCode version before importing.')
  const session = structuredClone(checkpoint.session)
  session.info.directory = resolve(env.PROJECT_DIR)
  delete session.info.parentID
  const file = join(env.RUNNER_TEMP, 'omgithub-session-import.json')
  writeFileSync(file, JSON.stringify(session), { mode: 0o600 })
  try {
    command(binary, ['import', file], { cwd: env.PROJECT_DIR })
    // Some CLI import errors exit zero. Prove all messages survived before submitting work.
    const restored = JSON.parse(command(binary, ['export', session.info.id], { cwd: env.PROJECT_DIR }))
    if (restored.info?.id !== session.info.id || restored.messages?.length !== session.messages.length ||
        session.messages.some(m => !restored.messages.some(r => r.info.id === m.info.id && r.parts.length === m.parts.length))) throw new Error('The saved conversation could not be restored completely.')
    setEnv('RESUME_SESSION_ID', session.info.id)
  } finally { rmSync(file, { force: true }) }
}
export function saveCheckpoint() {
  const root = resolve(env.GITHUB_WORKSPACE), project = resolve(env.PROJECT_DIR)
  const projectDir = relative(root, project)
  if (projectDir.startsWith('..') || projectDir.startsWith('/')) throw new Error('Project must be inside the repository.')
  const directory = env.OPENCODE_WEB_DIR
  const sessionFile = join(directory, 'checkpoint-session-id')
  if (!existsSync(sessionFile)) return null
  const sessionId = readFileSync(sessionFile, 'utf8').trim()
  if (!/^ses_[A-Za-z0-9]+$/.test(sessionId)) throw new Error('Invalid session ID.')
  const binary = env.OPENCODE_BIN || join(env.HOME, '.opencode/bin/opencode')
  const version = command(binary, ['--version'])
  const secrets = Object.entries(env).filter(([k]) => /TOKEN|SECRET|PASSWORD|API_KEY|AUTH_CONTENT|PRIVATE_KEY/.test(k)).map(([,v]) => v)
  // Authentication JSON can contain individual secrets echoed separately in tool output.
  const leaves = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(leaves) : []
  try { secrets.push(...leaves(JSON.parse(env.OPENCODE_AUTH_CONTENT || '{}'))) } catch {}
  const session = redactSession(JSON.parse(command(binary, ['export', sessionId], { cwd: project })), secrets)
  const issue = Number(env.TRIGGER_ISSUE_NUMBER), run = Number(env.GITHUB_RUN_ID)
  const branch = `opencode-checkpoints/${issue}`
  const source = { source_repository: env.GITHUB_REPOSITORY, source_issue: issue }
  const gitEnv = { ...env, GIT_INDEX_FILE: join(directory, `checkpoint-index-${process.pid}`) }
  const git = (...args) => command('git', args, { cwd: root, env: gitEnv })
  try {
    git('read-tree', 'HEAD')
    git('add', '-A', '--', '.')
    const files = command('git', ['ls-files', '-z'], { cwd: root, env: gitEnv }).split('\0').filter(Boolean)
    const exclude = files.filter(excludedPath)
    if (exclude.length) command('git', ['update-index', '--force-remove', '-z', '--stdin'], { cwd: root, env: gitEnv, input: `${exclude.join('\0')}\0` })
    const tree = git('write-tree')
    const fingerprint = digest(`${tree}\n${version}\n${JSON.stringify(session)}`)
    const stateFile = join(directory, 'checkpoint-state.json')
    let previous
    try { previous = JSON.parse(readFileSync(stateFile, 'utf8')) } catch {}
    if (previous?.fingerprint === fingerprint) return previous
    const parent = git('rev-parse', 'HEAD')
    const commit = git('commit-tree', tree, '-p', parent, '-m', `Save game and conversation for issue #${issue}\n\nRun: ${run}`)
    const checkpoint = validateCheckpoint({ version: 1, repository: env.GITHUB_REPOSITORY, issue_number: issue, run_id: run, commit, branch,
      project_dir: projectDir, opencode_version: version, session, public_history: true, created_at: new Date().toISOString() }, source)
    const repository = JSON.parse(api(`repos/${env.GITHUB_REPOSITORY}`))
    if (repository.private) throw new Error('Public session checkpoints require a public repository.')
    const path = join(directory, 'checkpoint.json')
    writeFileSync(path, JSON.stringify(checkpoint), { mode: 0o600 })
    if (Buffer.byteLength(JSON.stringify(checkpoint)) > 25 * 1024 * 1024) throw new Error('Checkpoint exceeds 25 MB.')
    const remote = git('ls-remote', 'origin', `refs/heads/${branch}`).split(/\s/)[0] || ''
    git('push', `--force-with-lease=refs/heads/${branch}:${remote}`, 'origin', `${commit}:refs/heads/${branch}`)
    const tag = `opencode-checkpoint-${issue}-${run}-${Date.now()}`
    // Keep the release hidden until the asset upload has completed. Never replace an older asset.
    command('gh', ['release', 'create', tag, path, '--repo', env.GITHUB_REPOSITORY, '--target', commit, '--draft', '--title', `Saved session #${issue}`, '--notes', 'Restore saved game code and its public OpenCode conversation.', '--latest=false'])
    command('gh', ['release', 'edit', tag, '--repo', env.GITHUB_REPOSITORY, '--draft=false', '--latest=false'])
    const state = { fingerprint, tag, commit }
    writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 })
    return state
  } finally { rmSync(gitEnv.GIT_INDEX_FILE, { force: true }) }
}
async function watch() {
  let stopping = false
  process.on('SIGTERM', () => { stopping = true })
  process.on('SIGINT', () => { stopping = true })
  while (!stopping) {
    try { saveCheckpoint() } catch (error) { process.stderr.write(`Checkpoint not saved: ${error.message}\n`) }
    const deadline = Date.now() + 300000
    while (!stopping && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 1000))
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const mode = process.argv[2]
    if (mode === 'prepare') prepare()
    else if (mode === 'restore') restore()
    else if (mode === 'save') saveCheckpoint()
    else if (mode === 'watch') await watch()
    else throw new Error('Use prepare, restore, save, or watch.')
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1 }
}
