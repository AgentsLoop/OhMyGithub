import assert from 'node:assert/strict'
import test from 'node:test'
import { extractUrls, omgRequest } from './github.mjs'

test('extractUrls separates OpenCode, screenshots, preview, and Pages result', () => {
  const result = extractUrls(
    { body: 'Build requested' },
    [{ body: [
      'OpenCode: https://chat.trycloudflare.com/session/ses_123',
      'Progress: ![shot](https://github.com/user-attachments/assets/abc-123)',
      'Preview: https://game.trycloudflare.com',
      'Published: https://agentsloop.github.io/example/branches/opencode-1/abc123/'
    ].join('\n') }]
  )

  assert.equal(result.opencode, 'https://chat.trycloudflare.com/session/ses_123')
  assert.equal(result.preview, 'https://game.trycloudflare.com')
  assert.equal(result.published, 'https://agentsloop.github.io/example/branches/opencode-1/abc123/')
  assert.deepEqual(result.screenshots, ['https://github.com/user-attachments/assets/abc-123'])
})

test('omgRequest routes test-gh when the label is added without requiring OpenCode', () => {
  const result = omgRequest('issues', {
    action: 'labeled',
    installation: { id: 42 },
    repository: { full_name: 'AgentsLoop/OhMyGithub', default_branch: 'main' },
    sender: { login: 'igor', type: 'User' },
    label: { name: 'test-gh' },
    issue: {
      number: 123,
      title: 'GitHub Pages smoke test',
      body: 'Publish Hello World',
      labels: [{ name: 'test-gh' }]
    }
  })

  assert.equal(result.testGhRequest, true)
  assert.equal(result.missingOpenCodeLabel, false)
  assert.deepEqual(result.labels, ['test-gh'])

  const openedWithLabel = omgRequest('issues', {
    action: 'opened',
    installation: { id: 42 },
    repository: { full_name: 'AgentsLoop/OhMyGithub', default_branch: 'main' },
    sender: { login: 'igor', type: 'User' },
    issue: {
      number: 123,
      title: 'GitHub Pages smoke test',
      body: 'Publish Hello World',
      labels: [{ name: 'test-gh' }]
    }
  })
  assert.equal(openedWithLabel, null)
})

test('omgRequest still asks for OpenCode on an ordinary unlabeled issue', () => {
  const result = omgRequest('issues', {
    action: 'opened',
    installation: { id: 42 },
    repository: { full_name: 'AgentsLoop/OhMyGithub', default_branch: 'main' },
    sender: { login: 'igor', type: 'User' },
    issue: {
      number: 124,
      title: 'Regular request',
      body: 'Build something',
      labels: []
    }
  })

  assert.equal(result.testGhRequest, false)
  assert.equal(result.missingOpenCodeLabel, true)
})
