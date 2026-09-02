import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import test from 'node:test'
import { activeWorkflowRun, createAppPullRequest, omgRequest, repositoryWorkflow } from './github.mjs'

test('repository workflow delegates concurrency ownership to the reusable job', () => {
  const workflow = repositoryWorkflow('AgentsLoop', 'OhMyGithub', 'feature/android')
  assert.doesNotMatch(workflow, /concurrency:/)
  assert.match(workflow, /opencode-reusable\.yml@feature\/android/)
})

test('opened issue carrying OpenCode dispatches directly', () => {
  const request = omgRequest('issues', {
    action: 'opened',
    sender: { type: 'User', login: 'maintainer' },
    installation: { id: 42 },
    repository: { full_name: 'AgentsLoop/OhMyGithub', default_branch: 'main' },
    issue: {
      number: 191,
      title: 'Todo app branch: feature/android',
      body: 'make todo app',
      user: { login: 'maintainer' },
      labels: [{ name: 'OpenCode' }, { name: 'Android' }]
    }
  })
  assert.equal(request.missingOpenCodeLabel, false)
  assert.equal(request.targetRef, 'feature/android')
  assert.deepEqual(request.labels, ['OpenCode', 'Android'])
})

test('active-run guard checks display title across queued and in-progress runs', async () => {
  const requestFetch = async () => Response.json({ workflow_runs: [
    { id: 1, status: 'completed', display_title: 'OpenCode #191 — old' },
    { id: 2, status: 'queued', name: 'OpenCode', display_title: 'OpenCode #191 — Todo app' }
  ] })
  const run = await activeWorkflowRun({ owner: 'AgentsLoop', repo: 'OhMyGithub', issueNumber: 191 }, {
    api: 'https://github.test', installationToken: 'token'
  }, requestFetch)
  assert.equal(run.id, 2)
})

test('App PR delivery authorizes the workflow run and exact generated commit', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
  const calls = []
  const commit = 'a'.repeat(40)
  const requestFetch = async (url, options = {}) => {
    calls.push({ url, options })
    if (url.endsWith('/actions/runs/123')) return Response.json({
      event: 'workflow_dispatch', status: 'in_progress', head_branch: 'feature/android',
      display_title: 'OpenCode #191 — Todo app', repository: { full_name: 'AgentsLoop/OhMyGithub' }
    })
    if (url.includes('/git/ref/heads/')) return Response.json({ object: { sha: commit } })
    if (url.endsWith('/installation')) return Response.json({ id: 77 })
    if (url.endsWith('/app/installations/77/access_tokens')) return Response.json({ token: 'installation-token', permissions: { pull_requests: 'write' } })
    if (url.endsWith('/pulls') && options.method === 'POST') return Response.json({ html_url: 'https://github.com/AgentsLoop/OhMyGithub/pull/9', number: 9 }, { status: 201 })
    return new Response('not found', { status: 404 })
  }
  const result = await createAppPullRequest({
    repository: 'AgentsLoop/OhMyGithub', run_id: 123, issue_number: 191,
    head: 'opencode/123', base: 'feature/android', commit,
    title: 'OpenCode: Todo app', body: 'Automated implementation'
  }, { api: 'https://github.test', appId: '1', privateKey: pem }, 'caller-token', requestFetch)

  assert.equal(result.route, 'app-created')
  assert.equal(result.pullRequestUrl, 'https://github.com/AgentsLoop/OhMyGithub/pull/9')
  assert.equal(calls.at(-1).options.headers.authorization, 'Bearer installation-token')
})

test('App PR delivery rejects a branch whose commit does not match', async () => {
  const requestFetch = async url => {
    if (url.endsWith('/actions/runs/123')) return Response.json({
      event: 'workflow_dispatch', status: 'in_progress', head_branch: 'main',
      display_title: 'OpenCode #191 — Todo', repository: { full_name: 'AgentsLoop/OhMyGithub' }
    })
    if (url.includes('/git/ref/heads/')) return Response.json({ object: { sha: 'b'.repeat(40) } })
    return new Response('not found', { status: 404 })
  }
  await assert.rejects(() => createAppPullRequest({
    repository: 'AgentsLoop/OhMyGithub', run_id: 123, issue_number: 191,
    head: 'opencode/123', base: 'main', commit: 'a'.repeat(40), title: 'Todo'
  }, { api: 'https://github.test' }, 'caller-token', requestFetch), /does not match/)
})
