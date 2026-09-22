import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
test('use callback credentials only for OmGithub callbacks; resolve release without GitHub REST', () => {
  const workflow = read('.github/workflows/opencode-reusable.yml')
  assert.doesNotMatch(workflow, /api\.github\.com\/repos\/anomalyco\/opencode\/releases/)
  assert.match(workflow, /url_effective.*https:\/\/github.com\/anomalyco\/opencode\/releases\/latest/)
  assert.match(workflow, /name: Register Actions progress\n        continue-on-error: true/)
  for (const name of ['run-record.mjs', 'session-deploy.mjs', 'session-lifecycle.mjs']) {
    const code = read(`scripts/${name}`)
    assert.match(code, /authorization: `Bearer \$\{env.OMGITHUB_CALLBACK_TOKEN/)
    assert.doesNotMatch(code, /authorization: `Bearer \$\{env.GH_TOKEN/)
  }
})
test('grant OIDC permission and bootstrap before checkout in both jobs', () => {
  for (const name of ['opencode-prepare.yml', 'opencode-reusable.yml']) {
    const workflow = read(`.github/workflows/${name}`)
    assert.match(workflow, /id-token: write/)
    assert.ok(workflow.indexOf('name: Authenticate status callbacks') < workflow.indexOf('uses: actions/checkout'))
    assert.match(workflow, /ACTIONS_ID_TOKEN_REQUEST_URL/)
  }
})
