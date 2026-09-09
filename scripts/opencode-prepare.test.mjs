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

test('open once, authorize writers, and freeze the branch', async () => {
  const f = fixture(); f.event.action = 'opened';
  const result = await f.run();
  assert.equal(result.target_ref, 'feature');
  assert.equal(result.target_sha, 'a'.repeat(40));
  assert.equal(result.issue_title, 'Build a game');
  assert.equal(result.request, f.event.issue.body);
  assert.equal(f.state.comments.length, 0);
  assert.equal(f.state.calls.some(call => /timeline|comments|actions/.test(call.path)), false);
});

test('reject outsiders by default and accept everyone when configured', async () => {
  const f = fixture({ permission: 'read' }); f.event.action = 'opened';
  await assert.rejects(f.run(), /author needs write/);
  f.env.OPENCODE_ACCESS = 'everyone';
  assert.equal((await f.run()).approved, 'true');
});

test('title trigger adds the execution label in either access mode', async () => {
  for (const access of ['writers', 'everyone']) {
    const f = fixture({ env: { OPENCODE_ACCESS: access } }); f.event.action = 'opened';
    f.state.current.title = '/OpenCode Build a game'; f.state.current.labels = [];
    const result = await f.run();
    assert.equal(result.approved, 'true');
    assert.equal(result.issue_title, 'Build a game');
    assert.deepEqual(JSON.parse(result.labels_json), ['OpenCode']);
  }
});

test('ignore later labels and unrelated titles', async () => {
  const f = fixture();
  assert.equal((await f.run()).approved, 'false');
  assert.equal(f.state.calls.length, 0);
  f.event.action = 'opened'; f.state.current.labels = [];
  for (const title of ['/OpenCodes Build', 'x/OpenCode Build', 'Build normally']) {
    f.state.current.title = title;
    assert.equal((await f.run()).approved, 'false');
  }
});

test('manual start reads an existing issue with the same access checks', async () => {
  const f = fixture({ env: { GITHUB_EVENT_NAME: 'workflow_dispatch' } });
  f.event.inputs = { issue_number: '42' }; delete f.event.issue;
  assert.equal((await f.run()).approved, 'true');
});

test('reject invalid access, closed issues, pull requests, branches and workflow refs', async () => {
  for (const change of [
    f => { f.env.OPENCODE_ACCESS = 'public'; },
    f => { f.state.current.state = 'closed'; },
    f => { f.state.current.pull_request = {}; },
    f => { f.state.current.title = 'Build branch: ../bad'; },
    f => { f.state.branch = ''; },
    f => { f.env.GITHUB_REF = 'refs/heads/other'; },
  ]) {
    const f = fixture(); f.event.action = 'opened'; change(f);
    await assert.rejects(f.run());
  }
});
