import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const workflow = readFileSync(new URL('../.github/workflows/opencode-reusable.yml', import.meta.url), 'utf8');
test('all tunnel parsers ignore API errors and select ready-box URLs', () => {
  const parsers = [...workflow.matchAll(/sed -nE '([^']+)'/g)].map(m => m[1]).filter(s => s.includes('trycloudflare'));
  assert.equal(parsers.length, 3);
  for (const parser of parsers) {
    assert.equal(execFileSync('sed', ['-nE', parser], { input: 'ERR https://api.trycloudflare.com/tunnel\nINF | https://worker-name.trycloudflare.com |\n', encoding: 'utf8' }).trim(), 'https://worker-name.trycloudflare.com');
  }
});
test('failure reporting attempts every operation despite earlier API failures', async () => {
  const block = workflow.split('      - name: Mark issue failed')[1].split('      - name:')[0];
  const script = block.split('          script: |\n')[1].split('\n').map(l => l.replace(/^            /, '')).join('\n');
  const calls = [];
  const fail = name => async () => { calls.push(name); throw new Error(name); };
  const github = { paginate: fail('jobs'), rest: { actions: { listJobsForWorkflowRun() {} }, issues: {
    createComment: fail('comment'), removeLabel: fail('remove'), addLabels: fail('add')
  } } };
  const run = new (Object.getPrototypeOf(async function() {}).constructor)('github','core','context','require',script);
  await run(github, { warning() {} }, { repo: { owner: 'o', repo: 'r' }, runId: 1 }, () => ({ renderTemplate: () => 'failure' }));
  assert.deepEqual(calls, ['jobs', 'comment', 'remove', 'remove', 'add']);
});
test('completion waits for tracker exit and refuses concurrent final writes', () => {
  const block = workflow.split('      - name: Publish worker completion report')[1].split('      - name:')[0];
  assert.match(block, /response-comment.done/);
  assert.match(block, /for _ in \{1\.\.60\}/);
  assert.match(block, /if kill -0 "\$tracker_pid"[\s\S]*exit 1/);
});

test('runtime does not require pull-request permission to execute or deliver branches', () => {
  assert.doesNotMatch(workflow, /pull-requests:\s*write/);
  assert.doesNotMatch(workflow, /gh pr create/);
});
