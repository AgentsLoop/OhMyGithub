import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCredentialClient, writeEnv, escapeCommand } from './account-credentials.mjs'
const initial = { openai: { type: 'oauth', access: 'initial-access', refresh: 'initial-refresh', expires: 123 } }
function fixture(t, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'credential-client-')); t.after(() => rmSync(dir, { force: true, recursive: true }))
  const env = { RUNNER_TEMP: dir, HOME: dir, GITHUB_ENV: join(dir, 'env'), GITHUB_REPOSITORY: 'owner/repo', GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1', TRIGGER_ISSUE_NUMBER: '5', ACTIONS_ID_TOKEN_REQUEST_URL: 'https://identity.test/token', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'request-token', ...extra }
  const calls = [], masks = []
  const client = createCredentialClient({ env, mask: v => masks.push(v), request: async (url, options) => {
    if (String(url).startsWith('https://identity.test')) return Response.json({ value: 'signed-oidc' })
    assert.equal(options.headers.authorization, 'Bearer signed-oidc')
    const body = JSON.parse(options.body); calls.push(body)
    return Response.json(body.operation === 'refresh' ? { revision: 'revision-2' } : { revision: 'revision-1', auth: body.use_auth ? initial : null, secrets: { CUSTOM_SERVICE: 'secret\nmultiline', EXISTING_KEY: 'account-value' } })
  } })
  return { dir, env, calls, masks, client, file: join(dir, '.local/share/opencode/auth.json') }
}
test('load account credentials, mask multiline values, preserve repository overrides, sync refresh and release', async t => {
  const f = fixture(t, { EXISTING_KEY: 'repository-value' })
  assert.deepEqual(await f.client.load(), { customSecrets: 1, accountAuth: true })
  assert.deepEqual(JSON.parse(readFileSync(f.file)), initial)
  const env = readFileSync(f.env.GITHUB_ENV, 'utf8')
  assert.match(env, /CUSTOM_SERVICE<</); assert.doesNotMatch(env, /EXISTING_KEY<</)
  assert.ok(f.masks.includes('initial-refresh')); assert.ok(f.masks.includes('secret\nmultiline'))
  writeFileSync(f.file, JSON.stringify({ openai: { ...initial.openai, access: 'updated-access' } }))
  await f.client.sync()
  assert.equal(f.calls.at(-1).auth.openai.access, 'updated-access')
  assert.equal(f.calls.at(-1).revision, 'revision-1')
  await f.client.sync(true)
  assert.equal(f.calls.at(-1).revision, 'revision-2'); assert.equal(f.calls.at(-1).release, true)
  assert.equal(existsSync(f.file), false)
})
test('repository auth JSON takes precedence and does not acquire account OAuth lease', async t => {
  const f = fixture(t, { OPENCODE_AUTH_CONTENT: JSON.stringify(initial) })
  assert.equal((await f.client.load()).accountAuth, false)
  assert.equal(f.calls[0].use_auth, false); assert.equal(existsSync(f.file), false)
})
test('environment file delimiters and workflow masking escape command characters', t => {
  const { dir } = fixture(t), file = join(dir, 'delimiter')
  writeEnv(file, 'CUSTOM_KEY', 'value\nEOF\n::error::hello')
  assert.match(readFileSync(file, 'utf8'), /^CUSTOM_KEY<<omgithub_/)
  assert.equal(escapeCommand('a%\r\nb'), 'a%25%0D%0Ab')
})
test('High models set CLI reasoning variant in all OpenCode invocation modes', () => {
  const workflow = readFileSync(new URL('../.github/workflows/opencode-reusable.yml', import.meta.url), 'utf8')
  assert.match(workflow, /\['openai\/gpt-6.1-sol', 'openai\/gpt-6-astra'\].includes\(model\) \? 'high'/)
  assert.match(workflow, /variant_args=\(--variant "\$OPENCODE_VARIANT"\)/)
  const invocations = workflow.split('\n').filter(line => line.includes('"$1" run'))
  assert.equal(invocations.length, 5)
  for (const line of invocations) assert.ok(line.includes('"${variant_args[@]}"'))
})


test('cleanup removes account auth even when a revision conflict already stopped sync', async t => {
  const f = fixture(t)
  await f.client.load()
  f.env.OMGITHUB_ACCOUNT_AUTH_FILE = f.file
  rmSync(f.client.stateFile)
  await f.client.sync(true)
  assert.equal(existsSync(f.file), false)
})
