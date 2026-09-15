import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { preparePreview } from './preview-setup.mjs'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'preview-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const env = { PROJECT_DIR: root, RUNTIME_DIR: root, OPENCODE_WEB_DIR: root, APP_URL: 'https://preview.test' }
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
  const capture = () => {
    for (const name of ['final-desktop.png', 'final-mobile.png']) writeFileSync(join(root, name), png)
  }
  return { env, evidence: root, capture }
}
test('runs startup and capture directly without OC', async t => {
  const f = fixture(t), calls = []
  await preparePreview({ ...f, repair: () => assert.fail('unexpected OC'), run: async (file, args, options) => {
    calls.push(args)
    if (args.length === 1 && args[0].endsWith('/capture.sh')) {
      assert.equal(options.env.CAPTURE_URL, f.env.APP_URL)
      assert.equal(options.env.CAPTURE_DIR, f.evidence)
      f.capture()
    }
  } })
  assert.equal(calls.length, 3)
})
test('repairs missing startup then reruns scripts', async t => {
  const f = fixture(t)
  let repaired = false, repairs = 0
  await preparePreview({ ...f, repair: async prompt => {
    repairs++; repaired = true
    assert.match(prompt, /Run every script/)
    assert.match(prompt, /Open and inspect both screenshots/)
  }, run: async (file, args) => {
    if (!repaired) throw new Error('missing startup.sh')
    if (args.length === 1 && args[0].endsWith('/capture.sh')) f.capture()
  } })
  assert.equal(repairs, 1)
})
test('rejects stale screenshots and bounds repairs', async t => {
  const f = fixture(t)
  f.capture()
  let repairs = 0
  await assert.rejects(preparePreview({ ...f, run: async () => {}, repair: async () => { repairs++ } }), /after two repairs/)
  assert.equal(repairs, 2)
})
test('cancellation does not invoke repair', async t => {
  const f = fixture(t), controller = new AbortController()
  await assert.rejects(preparePreview({ ...f, signal: controller.signal, repair: () => assert.fail('repair after abort'),
    run: async () => { controller.abort(); throw new Error('Cancelled') } }), /Cancelled/)
})
