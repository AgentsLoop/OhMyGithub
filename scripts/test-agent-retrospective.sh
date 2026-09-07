#!/usr/bin/env bash
set -euo pipefail

node <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {
  decodeGuidance,
  extractPromptAlignment,
  normalizeRetrospective,
  renderAgentRetrospective
} = require('./.github/scripts/agent-retrospective.cjs');

const value = normalizeRetrospective({
  status: 'ok',
  summary_markdown: '## Outcome\n\nThe fixture completed, but evidence was thin.',
  prompt_alignment: ['Capture evidence before claiming completion.', 'Capture evidence before claiming completion.'],
  skill_recommendations: [
    { name: 'game-studio:game-playtest', action: 'improve', reason: 'Add a repeatable browser smoke check.' }
  ]
});
const rendered = renderAgentRetrospective(value);
assert.match(rendered, /<details>/);
assert.match(rendered, /Skills to add or improve/);
assert.match(rendered, /game-studio:game-playtest/);
assert.deepEqual(decodeGuidance(rendered).prompt_alignment, ['Capture evidence before claiming completion.']);

const comments = [
  { body: '<!-- opencode-agent-retrospective-data:v1 eyJwcm9tcHRfYWxpZ25tZW50IjpbIk9sZCBub3RlIl19 -->' },
  { body: rendered }
];
assert.deepEqual(extractPromptAlignment(comments), [
  'Capture evidence before claiming completion.',
  'Old note'
]);
assert.match(renderAgentRetrospective({ status: 'unavailable', reason: 'model timeout' }), /model timeout/);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-retrospective-test-'));
const captureFile = path.join(tempDir, 'opencode-argv.json');
const fakeOpenCode = path.join(tempDir, 'fake-opencode.cjs');
fs.writeFileSync(fakeOpenCode, `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(process.env.CAPTURE_FILE, JSON.stringify(process.argv.slice(2)));\n`);
fs.chmodSync(fakeOpenCode, 0o755);
const evidenceFile = path.join(tempDir, 'evidence.md');
fs.writeFileSync(evidenceFile, 'workflow passed\n');
const outputFile = path.join(tempDir, 'retrospective.json');
const assistantMessage = {
  info: { role: 'assistant' },
  parts: [{ type: 'text', text: JSON.stringify({
    status: 'ok',
    summary_markdown: '## Outcome\\n\\nOpenCode completed the fixture.',
    prompt_alignment: ['Inspect browser evidence before claiming completion.'],
    skill_recommendations: [{ name: 'game-studio:game-playtest', action: 'improve', reason: 'Keep browser evidence repeatable.' }]
  }) }]
};
const server = http.createServer((request, res) => {
  if (request.url === '/session/test-session/message') {
    const body = JSON.stringify([assistantMessage]);
    res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
    res.end(body);
    return;
  }
  res.writeHead(404);
  res.end();
});

const waitForServer = new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const run = (command, args, env) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', (code) => resolve({ code, stdout, stderr }));
});

(async () => {
  await waitForServer;
  const port = server.address().port;
  const result = await run('./.github/scripts/generate-agent-retrospective.sh', [], {
    ...process.env,
    RETROSPECTIVE_TEMPLATE: './.github/prompts/06-agent-retrospective.md',
    ORIGINAL_REQUEST: 'test request',
    AVAILABLE_SKILLS: 'game-studio:game-playtest',
    WORKFLOW_EVIDENCE_FILE: evidenceFile,
    OUTPUT_FILE: outputFile,
    OPENCODE_BIN: fakeOpenCode,
    OPENCODE_WEB_PORT: String(port),
    PROJECT_DIR: tempDir,
    OPENCODE_SESSION_ID: 'test-session',
    OPENCODE_MODEL: 'test-model',
    CAPTURE_FILE: captureFile,
    OUTPUT_LOG_FILE: path.join(tempDir, 'opencode.log')
  });
  server.close();
  assert.equal(result.code, 0, JSON.stringify(result));
  const generated = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  assert.equal(generated.status, 'ok');
  assert.equal(generated.skill_recommendations[0].name, 'game-studio:game-playtest');
  const argv = JSON.parse(fs.readFileSync(captureFile, 'utf8'));
  assert.ok(argv.includes('--session'));
  assert.ok(argv.includes('test-session'));
  assert.ok(argv.includes('--model'));
  assert.ok(argv.includes('test-model'));
  assert.match(argv.at(-1), /The complete transcript is already in this OpenCode session/);
  console.log('Agent retrospective renderer, guidance, and OpenCode follow-up tests passed.');
})().catch((error) => {
  server.close();
  console.error(error);
  process.exitCode = 1;
});
NODE
