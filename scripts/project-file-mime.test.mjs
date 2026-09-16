import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { browserMimeTypes } from './project-file-mime.mjs'

test('preserves installed types and normalizes browser assets without duplicates', () => {
  const output = browserMimeTypes('types { # comment\n image/png png; application/javascript js mjs; application/octet-stream wasm; video/mp4 mp4; }')
  for (const rule of ['image/png png;', 'video/mp4 mp4;', 'text/css css;', 'text/javascript js;', 'text/javascript mjs;', 'application/wasm wasm;', 'font/woff2 woff2;', 'model/gltf-binary glb;']) assert.ok(output.includes(rule), rule)
  assert.equal(output.match(/\bwasm;/g).length, 1)
  assert.equal(output.match(/\bjs;/g).length, 1)
  assert.throws(() => browserMimeTypes(''), /Invalid/)
})

test('standalone file server exposes directory listings without automatic index pages', () => {
  const workflow = readFileSync(new URL('../.github/workflows/opencode-reusable.yml', import.meta.url), 'utf8')
  assert.ok(workflow.includes('scripts/project-file-mime.mjs'))
  assert.ok(workflow.includes('include "$NGINX_PREFIX/mime.types";'))
  assert.ok(workflow.includes('default_type application/octet-stream;'))
  assert.ok(workflow.includes('index __codex_no_automatic_index_file__;'))
  assert.ok(workflow.includes('add_header Cache-Control "no-cache" always;'))
  assert.ok(workflow.includes('autoindex on;'))
})
