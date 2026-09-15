import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
test('main prompt contains only the user request', () => {
  assert.equal(read('../.github/prompts/01-build.md'), '@COMMENT_BODY@\n')
})
test('script preparation precedes checkpoint replacement and publication', () => {
  const source = read('./session-deploy.mjs')
  const setup = source.indexOf('await preparePreview(')
  const save = source.indexOf("'scripts/session-checkpoint.mjs'")
  assert.ok(setup > 0 && setup < save)
  assert.ok(source.indexOf('const deployed =') > save)
  assert.doesNotMatch(source, /assertSource|validation\.json.*passed|RESTART_APP/)
  assert.doesNotMatch(read('./session-lifecycle.mjs'), /--session.*mainID\(\)/)
})
