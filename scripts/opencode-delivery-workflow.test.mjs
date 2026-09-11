import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/opencode-reusable.yml', import.meta.url), 'utf8');

test('publishes the generated branch when validation is disabled', () => {
  assert.match(
    workflow,
    /- name: Push project branch\n\s+if: env\.SSH_ONLY_REQUEST != 'true'\n/,
  );
});

test('optionally creates a pull request for a published branch', () => {
  assert.match(workflow, /PULL_REQUEST_ENABLED: \$\{\{ vars\.PULL_REQUEST_ENABLED \|\| 'false' \}\}/);
  assert.match(workflow, /- name: Create pull request\n[\s\S]*?if: steps\.delivery\.outputs\.commit != '' && env\.PULL_REQUEST_ENABLED == 'true'/);
  assert.match(workflow, /pull-requests: write/);
});

test('adds branch and optional pull request links to the live issue comment', () => {
  assert.match(
    workflow,
    /- name: Stop live progress updates[\s\S]*?touch "\$OPENCODE_WEB_DIR\/response-comment\.done"[\s\S]*?- name: Push project branch[\s\S]*?- name: Post delivery links/,
  );
  assert.match(workflow, /- name: Post delivery links\n[\s\S]*?BRANCH_URL:[\s\S]*?PULL_REQUEST_URL:/);
  assert.match(workflow, /Created branch: \[\$\{process\.env\.BRANCH_NAME\}\]\(\$\{process\.env\.BRANCH_URL\}\)/);
});
