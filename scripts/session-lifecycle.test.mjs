import test from 'node:test'
import assert from 'node:assert/strict'
import { Lifecycle } from './session-lifecycle.mjs'
const tick = () => new Promise(resolve => setImmediate(resolve))
test('completion saves before deploying and deduplicates the same response', async () => {
  const calls = []
  const lifecycle = new Lifecycle({ save: async () => { calls.push('save'); return {} }, deploy: async () => calls.push('deploy') })
  await lifecycle.complete('m1'); await lifecycle.complete('m1')
  assert.deepEqual(calls, ['save', 'deploy'])
})
test('new input aborts and drains validation before allowing the main session', async () => {
  const calls = []
  const lifecycle = new Lifecycle({ save: async () => ({}), deploy: ({ signal }) => new Promise(resolve => {
    calls.push('deploy'); signal.addEventListener('abort', async () => { await tick(); calls.push('stopped'); resolve() })
  }), status: state => calls.push(state) })
  const completion = lifecycle.complete('m1'); await tick()
  await lifecycle.busy(); calls.push('main starts'); await completion
  assert.ok(calls.indexOf('stopped') < calls.indexOf('main starts'))
  assert.equal(calls.includes('ready'), false)
})
test('shutdown saves changed state without starting a validation', async () => {
  const calls = []
  const lifecycle = new Lifecycle({ save: async (_, interrupted) => calls.push(interrupted), deploy: async () => calls.push('deploy') })
  await lifecycle.shutdown(); await lifecycle.complete('m2')
  assert.deepEqual(calls, [true])
})
test('new input during asynchronous generation registration prevents stale save', async () => {
  let release
  const calls = []
  const lifecycle = new Lifecycle({ save: async () => { calls.push('save'); return {} }, deploy: async () => calls.push('deploy'),
    status: (state, generation) => generation === 1 ? new Promise(resolve => { release = resolve }) : undefined })
  const completion = lifecycle.complete('m1')
  await tick()
  await lifecycle.busy()
  release(); await completion
  assert.deepEqual(calls, [])
})
test('retry completion after registration failure instead of silently deduplicating it', async () => {
  let broken = true
  const calls = []
  const lifecycle = new Lifecycle({ save: async () => { calls.push('save'); return {} }, deploy: async () => calls.push('deploy'), status: async state => {
    if (state === 'working' && broken) throw new Error('registration unavailable')
  } })
  await assert.rejects(lifecycle.complete('m1'), /registration unavailable/)
  broken = false
  await lifecycle.complete('m1')
  assert.deepEqual(calls, ['save', 'deploy'])
})
test('invalidate remote deployment before waiting for a cancelled worker', async () => {
  const calls = []
  const lifecycle = new Lifecycle({ save: async () => ({}), status: async state => calls.push(state), deploy: ({signal}) => new Promise(resolve => {
    signal.addEventListener('abort', () => setImmediate(() => { calls.push('drained'); resolve() }))
  }) })
  const completion = lifecycle.complete('m1'); await tick()
  calls.length = 0
  await lifecycle.busy(); await completion
  assert.deepEqual(calls, ['working', 'drained'])
})
