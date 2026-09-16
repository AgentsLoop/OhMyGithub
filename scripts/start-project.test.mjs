import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

function run(t, mode, script = 'exit 0\n', restart = false, repeat = 1) {
  const root = mkdtempSync(join(tmpdir(), 'startup-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const bin = join(root, 'bin')
  mkdirSync(bin)
  if (script !== null) writeFileSync(join(root, 'start.sh'), script)
  writeFileSync(join(root, 'calls'), '')
  const stub = (name, body) => writeFileSync(join(bin, name), `#!/bin/bash\n${body}\n`, { mode: 0o755 })
  stub('sleep', 'exit 0')
  stub('tmux', `echo "$1" >> "$PROJECT_DIR/calls"; [[ "$1" != new-session ]] || touch "$PROJECT_DIR/started"`)
  stub('curl', `
    url="\${!#}"
    if [[ "$url" == https://public.test ]]; then [[ "$TEST_MODE" != public-failure ]]; exit $?; fi
    [[ "$TEST_MODE" != local-failure ]] || exit 1
    [[ "$TEST_MODE" == running || -f "$PROJECT_DIR/started" ]]
  `)
  let result
  for (let i = 0; i < repeat; i++) result = spawnSync('bash', [fileURLToPath(new URL('./start-project.sh', import.meta.url))], {
    encoding: 'utf8', timeout: 20000,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PROJECT_DIR: root, RUNTIME_DIR: root, OPENCODE_WEB_DIR: root, APP_URL: 'https://public.test', APP_PORT: '3000', CHECKPOINT_COMMIT: repeat > 1 ? 'same-checkpoint' : '', TEST_MODE: mode, RESTART_APP: String(restart) }
  })
  return { ...result, calls: readFileSync(join(root, 'calls'), 'utf8') }
}
test('starts a stopped app and checks local and public readiness', t => {
  const result = run(t, 'stopped')
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.calls, /new-session/)
})
test('reuses an already running app', t => {
  const result = run(t, 'running')
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.calls, '')
})
test('rejects missing or malformed startup scripts', t => {
  assert.notEqual(run(t, 'running', null).status, 0)
  assert.notEqual(run(t, 'running', 'if then\n').status, 0)
})
test('fails closed for local and public startup failures', t => {
  assert.match(run(t, 'local-failure').stderr, /Local startup failed/)
  assert.match(run(t, 'public-failure').stderr, /Public preview did not become ready/)
})

test('restart current server after completion to rebuild the latest source', t => {
  const result = run(t, 'running', 'exit 0\n', true)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.calls, /kill-session/)
  assert.match(result.calls, /new-session/)
})

test('public retry across launcher invocations preserves the healthy checkpoint server', t => {
  const result = run(t, 'public-failure', 'exit 0\n', false, 3)
  assert.equal(result.status, 75)
  assert.equal((result.calls.match(/new-session/g) || []).length, 1)
})
