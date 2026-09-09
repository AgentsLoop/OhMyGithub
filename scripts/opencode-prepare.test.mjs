import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareRequest, outputText } from './opencode-prepare.mjs';

function fixture(options = {}) {
  const issue = { id: 420, number: 42, title: 'Build a game branch: feature', body: 'Make it playable\nKeep controls simple.', state: 'open', user: { login: 'visitor', id: 7, type: 'User' }, labels: [{ name: 'OpenCode' }, { name: 'test' }], created_at: '2026-09-09T01:00:00Z', updated_at: '2026-09-09T01:00:10Z' };
  const event = { action: 'labeled', label: { name: 'OpenCode' }, issue, repository: { full_name: 'owner/repo' }, sender: { id: 7 } };
  const env = { GITHUB_REPOSITORY: 'owner/repo', GITHUB_EVENT_NAME: 'issues', GITHUB_RUN_ID: '100', GITHUB_RUN_ATTEMPT: '1', GITHUB_REF: 'refs/heads/main', GH_TOKEN: 'repository-token', ...options.env };
  const state = { current: structuredClone(issue), comments: [], runs: { '100/attempts/1': { id: 100, event: 'issues', status: 'in_progress', created_at: '2026-09-09T01:00:11Z' } }, branch: 'a'.repeat(40), calls: [] };
  const fetcher = async (url, request) => {
    assert.equal(new URL(url).origin, 'https://api.github.com');
    assert.equal(request.headers.Authorization, 'Bearer repository-token');
    const path = new URL(url).pathname.replace('/repos/owner/repo', '');
    state.calls.push({ path, request });
    let data;
    if (path === '') data = { default_branch: 'main' };
    else if (path === '/issues/42') data = state.current;
    else if (path.startsWith('/actions/runs/')) data = state.runs[path.slice('/actions/runs/'.length)];
    else if (path.startsWith('/collaborators/')) data = { permission: options.permission || 'write' };
    else if (path === '/issues/42/timeline') data = [{ id: 88, event: 'labeled', label: { name: 'OpenCode' }, actor: { id: 7 }, created_at: event.issue.updated_at }];
    else if (path.startsWith('/branches/')) data = { commit: { sha: state.branch } };
    else if (path === '/issues/42/comments' && request.method === 'POST') {
      data = { id: state.comments.length + 1, user: { login: 'github-actions[bot]', type: 'Bot' }, ...JSON.parse(request.body) };
      state.comments.push(data);
    } else if (path === '/issues/42/comments') data = [...state.comments];
    else if (path === '/issues/42/labels') {
      state.current.labels.push({ name: 'OpenCode' });
      data = state.current.labels;
    } else throw new Error(`Unexpected path ${path}`);
    if (!data) return { ok: false, status: 404 };
    return { ok: true, status: 200, json: async () => structuredClone(data) };
  };
  return { event, env, state, run: () => prepareRequest(event, env, fetcher) };
}

test('preserve multiline requests without output injection', () => {
  const value = 'first\napproved=false\nEOF\nlast';
  const text = outputText({ request: value });
  const delimiter = text.split('\n')[0].split('<<')[1];
  assert.equal(text, `request<<${delimiter}\n${value}\n${delimiter}\n`);
});

test('authorize writers and freeze branch/request using only repository GitHub API', async () => {
  const f = fixture();
  const result = await f.run();
  assert.equal(result.target_ref, 'feature');
  assert.equal(result.target_sha, 'a'.repeat(40));
  assert.equal(result.issue_title, 'Build a game');
  assert.equal(result.request, f.event.issue.body);
  assert.equal(result.sender, 'visitor');
  assert.deepEqual(JSON.parse(result.labels_json), ['OpenCode', 'test']);
  assert.equal(f.state.comments.length, 1);
});

test('default access rejects an outsider even when someone else applies the label', async () => {
  const f = fixture({ permission: 'read' });
  await assert.rejects(f.run(), /author needs write/);
  assert.equal(f.state.comments.length, 0);
});

test('everyone accepts outsider label requests without a collaborator lookup', async () => {
  const f = fixture({ permission: 'read', env: { OPENCODE_ACCESS: 'everyone' } });
  assert.equal((await f.run()).approved, 'true');
  assert.equal(f.state.calls.some(call => call.path.startsWith('/collaborators/')), false);
});

test('everyone title marker adds the label and runs without a label permission', async () => {
  const f = fixture({ permission: 'read', env: { OPENCODE_ACCESS: 'everyone' } });
  f.event.action = 'opened';
  delete f.event.label;
  f.event.issue.title = '/OpenCode Build a game';
  f.event.issue.labels = [];
  f.state.current = structuredClone(f.event.issue);
  const result = await f.run();
  assert.equal(result.approved, 'true');
  assert.equal(result.issue_title, 'Build a game');
  assert.equal(result.target_ref, 'main');
  assert.deepEqual(JSON.parse(result.labels_json), ['OpenCode']);
  assert.equal(f.state.calls.filter(call => call.path.endsWith('/labels')).length, 1);
});

test('opened issues with an existing execution label leave execution to the label event', async () => {
  const f = fixture({ env: { OPENCODE_ACCESS: 'everyone' } });
  f.event.action = 'opened';
  f.event.issue.title = '/OpenCode Build a game';
  assert.equal((await f.run()).approved, 'false');
  assert.equal(f.state.calls.length, 0);
});

test('title entry requires everyone and an exact marker; unrelated events skip', async () => {
  for (const title of ['/OpenCodes Build', 'x/OpenCode Build', 'Build normally']) {
    const f = fixture({ env: { OPENCODE_ACCESS: 'everyone' } });
    f.event.action = 'opened'; f.event.issue.labels = []; f.event.issue.title = title;
    assert.equal((await f.run()).approved, 'false');
  }
  const f = fixture();
  f.event.action = 'opened'; f.event.issue.labels = []; f.event.issue.title = '/OpenCode Build';
  assert.equal((await f.run()).approved, 'false');
});

test('invalid access value fails closed', async () => {
  await assert.rejects(fixture({ env: { OPENCODE_ACCESS: 'public' } }).run(), /writers or everyone/);
});

test('reject changed requests and invalid or missing branches before a claim', async () => {
  const f = fixture(); f.state.current.body = 'Changed';
  await assert.rejects(f.run(), /changed/);
  const g = fixture(); g.event.issue.title = 'Build branch: ../bad';
  await assert.rejects(g.run(), /Invalid branch/);
  const h = fixture(); h.state.branch = '';
  await assert.rejects(h.run(), /valid commit/);
});

test('reject duplicate active/completed claims and preserve SHA on a failed retry', async () => {
  const f = fixture();
  await f.run();
  await assert.rejects(f.run(), /active execution/);
  const prior = f.state.runs['100/attempts/1'];
  prior.status = 'completed'; prior.conclusion = 'success';
  await assert.rejects(f.run(), /already ran/);
  prior.conclusion = 'failure';
  f.env.GITHUB_RUN_ATTEMPT = '2';
  f.state.runs['100/attempts/2'] = { ...prior, status: 'in_progress' };
  f.state.current.labels.push({ name: 'failed' });
  f.state.branch = 'b'.repeat(40);
  assert.equal((await f.run()).target_sha, 'a'.repeat(40));
});

test('ignore forged claim comments from an issue author', async () => {
  const f = fixture();
  f.state.comments.push({ user: { login: 'visitor', type: 'User' }, body: '<!-- opencode-request-v1\n{"key":"labeled:88","run":"999","attempt":"1"}\n-->' });
  assert.equal((await f.run()).approved, 'true');
});
