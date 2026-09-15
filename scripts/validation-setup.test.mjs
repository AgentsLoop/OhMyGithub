import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
test('main prompt contains only the user request', () => {
  assert.equal(read('../.github/prompts/01-build.md'), '@COMMENT_BODY@\n')
})
test('fork setup precedes checkpoint replacement and read-only validation', () => {
  const source = read('./session-deploy.mjs')
  const setup = source.indexOf('await runFork(`Prepare validation startup')
  const save = source.indexOf("'scripts/session-checkpoint.mjs'")
  const validate = source.indexOf('const prompt = `Validate the shared live app')
  assert.ok(setup > 0 && setup < save && save < validate)
  assert.match(source, /attempt === 2/)
  assert.doesNotMatch(read('./session-lifecycle.mjs'), /--session.*mainID\(\)/)
})
