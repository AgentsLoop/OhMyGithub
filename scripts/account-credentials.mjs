import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'

const leaves = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(leaves) : []
export const escapeCommand = value => String(value).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
export function writeEnv(file, name, value) {
  let delimiter
  do { delimiter = `omgithub_${randomUUID()}` } while (String(value).split(/\r?\n/).includes(delimiter))
  appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`)
}
export function createCredentialClient({ env = process.env, request = fetch, mask = value => console.log(`::add-mask::${escapeCommand(value)}`) } = {}) {
  const origin = (env.OMGITHUB_ORIGIN || 'https://omgithub.com').replace(/\/$/, '')
  const directory = join(env.RUNNER_TEMP, 'omgithub-account-credentials')
  const stateFile = join(directory, 'state.json'), secretFile = join(directory, 'values.json')
  const authFile = join(env.XDG_DATA_HOME || join(env.HOME, '.local/share'), 'opencode/auth.json')
  const save = (file, value) => { mkdirSync(dirname(file), { recursive: true, mode: 0o700 }); const tmp = `${file}.tmp`; writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 }); renameSync(tmp, file) }
  function remember(value) {
    const values = existsSync(secretFile) ? JSON.parse(readFileSync(secretFile, 'utf8')) : []
    for (const item of leaves(value)) if (item && !values.includes(item)) { mask(item); values.push(item) }
    save(secretFile, values)
  }
  async function call(body) {
    const url = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL); url.searchParams.set('audience', origin)
    const identity = await request(url, { headers: { authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` }, signal: AbortSignal.timeout(15000) })
    if (!identity.ok) throw new Error(`Workflow identity HTTP ${identity.status}`)
    const { value } = await identity.json()
    const response = await request(`${origin}/api/github/${env.GITHUB_REPOSITORY}/issues/${env.TRIGGER_ISSUE_NUMBER}/credentials`, {
      method: 'POST', headers: { authorization: `Bearer ${value}`, 'content-type': 'application/json' },
      body: JSON.stringify({ run: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT, ...body }), signal: AbortSignal.timeout(15000)
    })
    if (!response.ok) throw Object.assign(new Error(`Account credentials HTTP ${response.status}`), { status: response.status })
    return response.json()
  }
  async function load() {
    const data = await call({ use_auth: !env.OPENCODE_AUTH_CONTENT })
    remember(data.secrets)
    const names = []
    for (const [name, value] of Object.entries(data.secrets || {})) {
      if (!/^[A-Z][A-Z0-9_]{0,99}$/.test(name) || typeof value !== 'string') throw new Error('Invalid account secret payload')
      // Explicit workflow/repository environment values take precedence.
      if (env[name]) continue
      writeEnv(env.GITHUB_ENV, name, value); names.push(name)
    }
    if (data.auth && !env.OPENCODE_AUTH_CONTENT) {
      remember(data.auth)
      save(authFile, data.auth)
      save(stateFile, { revision: data.revision, auth: data.auth })
      writeEnv(env.GITHUB_ENV, 'OMGITHUB_ACCOUNT_AUTH_FILE', authFile)
    }
    writeEnv(env.GITHUB_ENV, 'OMGITHUB_SECRET_VALUES_FILE', secretFile)
    return { customSecrets: names.length, accountAuth: Boolean(data.auth && !env.OPENCODE_AUTH_CONTENT) }
  }
  async function sync(release = false) {
    if (!existsSync(stateFile)) return
    const state = JSON.parse(readFileSync(stateFile, 'utf8'))
    const auth = JSON.parse(readFileSync(authFile, 'utf8'))
    // Only return the providers actually checked out from this account.
    const selected = Object.fromEntries(Object.keys(state.auth).map(key => [key, auth[key]]))
    remember(selected)
    const changed = JSON.stringify(selected) !== JSON.stringify(state.auth)
    try {
      const data = await call({ operation: 'refresh', revision: state.revision, ...(changed ? { auth: selected } : {}), release })
      save(stateFile, { revision: data.revision, auth: selected })
    } catch (error) {
      if (error.status === 409) { rmSync(stateFile, { force: true }); console.log('Account credentials changed; retained the newer account version.'); return }
      throw error
    } finally {
      if (release) { rmSync(stateFile, { force: true }); rmSync(authFile, { force: true }) }
    }
  }
  return { load, sync, stateFile }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const client = createCredentialClient(), mode = process.argv[2] || 'load'
  if (mode === 'load') {
    const deadline = Date.now() + 5 * 3600000
    let warned = false
    for (;;) {
      try { const result = await client.load(); console.log(`Loaded ${result.customSecrets} account secret(s); subscription auth: ${result.accountAuth ? 'account' : 'repository/default'}.`); break }
      catch (error) {
        if (error.status !== 423 || Date.now() >= deadline) throw error
        if (!warned) { console.log('Waiting for another run using this account’s subscription credentials.'); warned = true }
        await new Promise(resolve => setTimeout(resolve, 15000))
      }
    }
  } else if (mode === 'watch') {
    while (existsSync(client.stateFile)) {
      await new Promise(resolve => setTimeout(resolve, 60000))
      try { await client.sync() } catch { console.log('Account auth sync unavailable; retrying in one minute.') }
    }
  } else if (mode === 'release') await client.sync(true)
  else throw new Error('Unknown credentials operation')
}
