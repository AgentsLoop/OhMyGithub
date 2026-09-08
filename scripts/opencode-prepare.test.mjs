import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepare, validateOutputs, outputText } from './opencode-prepare.mjs';

const approved = { approved: true, issue_number: '42', request: 'Build it\nwith details', issue_title: 'Build it', sender: 'owner', labels_json: '["OpenCode"]', target_ref: 'feature/game', target_sha: 'a'.repeat(40) };
test('reject mismatched issue, missing commit, denied approval, and malformed labels', () => {
  for (const change of [{ issue_number: '43' }, { target_sha: 'main' }, { approved: false }, { labels_json: '{}' }, { labels_json: '["test"]' }]) {
    assert.throws(() => validateOutputs({ ...approved, ...change }, 42));
  }
});
test('preserve multiline requests without output injection', () => {
  const text = outputText({ request: 'first\napproved=false\nEOF\nlast' });
  const delimiter = text.split('\n')[0].split('<<')[1];
  assert.equal(text, `request<<${delimiter}\nfirst\napproved=false\nEOF\nlast\n${delimiter}\n`);
});
test('bind OIDC audience and submit the exact event snapshot', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'omg-prepare-'));
  try {
    const event = { action: 'labeled', label: { name: 'OpenCode' }, issue: { number: 42, body: 'original' } };
    const env = { GITHUB_EVENT_NAME: 'issues', GITHUB_EVENT_PATH: join(dir, 'event.json'), GITHUB_OUTPUT: join(dir, 'output'), OMG_APP_ORIGIN: 'https://omgithub.com', ACTIONS_ID_TOKEN_REQUEST_URL: 'https://oidc.example/token?x=1', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'request-token' };
    writeFileSync(env.GITHUB_EVENT_PATH, JSON.stringify(event));
    const calls = [];
    await prepare(env, async (url, options) => {
      calls.push({ url: String(url), options });
      return { ok: true, json: async () => calls.length === 1 ? { value: 'oidc-token' } : approved };
    });
    assert.equal(new URL(calls[0].url).searchParams.get('audience'), 'https://omgithub.com/api/opencode/prepare');
    assert.deepEqual(JSON.parse(calls[1].options.body), { event });
    assert.equal(calls[1].options.headers.Authorization, 'Bearer oidc-token');
    assert.match(readFileSync(env.GITHUB_OUTPUT, 'utf8'), /approved<<omg_/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('publish safe failure text and never write execution outputs on denial', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'omg-prepare-'));
  try {
    const env = { GITHUB_EVENT_NAME: 'issues', GITHUB_EVENT_PATH: join(dir, 'event.json'), GITHUB_OUTPUT: join(dir, 'output'), OMG_APP_ORIGIN: 'https://omgithub.com', ACTIONS_ID_TOKEN_REQUEST_URL: 'https://oidc.example/token', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'secret', GITHUB_REPOSITORY: 'owner/repo', GITHUB_RUN_ID: '123', GH_TOKEN: 'github-secret' };
    writeFileSync(env.GITHUB_EVENT_PATH, JSON.stringify({ action: 'labeled', label: { name: 'OpenCode' }, issue: { number: 42 } }));
    const calls = [];
    await assert.rejects(prepare(env, async (url, options) => {
      calls.push({ url: String(url), options });
      if (calls.length === 1) return { ok: true, json: async () => ({ value: 'private-oidc' }) };
      return { ok: calls.length === 3, status: 403, json: async () => ({ error: 'Request is not approved' }) };
    }));
    assert.equal(calls.length, 3);
    assert.match(calls[2].url, /issues\/42\/comments$/);
    assert.doesNotMatch(calls[2].options.body, /private-oidc|github-secret/);
    assert.throws(() => readFileSync(env.GITHUB_OUTPUT));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
