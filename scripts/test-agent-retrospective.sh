#!/usr/bin/env bash
set -euo pipefail

node <<'NODE'
const assert = require('node:assert/strict');
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
console.log('Agent retrospective rendering and guidance tests passed.');
NODE
