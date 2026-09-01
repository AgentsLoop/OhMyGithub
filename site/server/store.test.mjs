import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createStore } from './store.mjs'

test('delivery claims are idempotent and can be released after a failed dispatch', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'omgithub-store-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const store = createStore(directory)

  assert.equal(await store.claimDelivery('delivery-123', { repository: 'AgentsLoop/OhMyGithub' }), true)
  assert.equal(await store.claimDelivery('delivery-123'), false)
  await store.releaseDelivery('delivery-123')
  assert.equal(await store.claimDelivery('delivery-123'), true)
})
