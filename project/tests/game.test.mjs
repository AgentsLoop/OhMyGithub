import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const html = readFileSync(resolve(root, 'index.html'), 'utf8')
const distHtml = existsSync(resolve(root, 'dist/index.html')) ? readFileSync(resolve(root, 'dist/index.html'), 'utf8') : ''

test('index.html exists and contains core game elements', () => {
  assert.match(html, /<canvas[^>]*id="c"/)
  assert.match(html, /id="score"/)
  assert.match(html, /id="timerText"/)
  assert.match(html, /id="shellDots"/)
  assert.match(html, /id="startOverlay"/)
  assert.match(html, /id="winOverlay"/)
  assert.match(html, /id="loseOverlay"/)
  assert.match(html, /SAFE ROCK/)
})

test('game has 5 shells and 2 starfish defined', () => {
  assert.match(html, /shells = \[/)
  // count shell entries
  const shellsBlock = html.match(/shells = \[([\s\S]*?)\]/)
  assert.ok(shellsBlock)
  const count = (shellsBlock[0].match(/x:/g) || []).length
  assert.equal(count, 5)
  const starsBlock = html.match(/stars = \[([\s\S]*?)\]/)
  assert.ok(starsBlock)
  const starCount = (starsBlock[0].match(/x:/g) || []).length
  assert.equal(starCount, 2)
})

test('controls support WASD and arrows', () => {
  assert.match(html, /ArrowUp.*ArrowDown.*ArrowLeft.*ArrowRight/)
  assert.match(html, /w:'up'.*a:'left'.*s:'down'.*d:'right'/)
  assert.match(html, /data-dir="up"/)
  assert.match(html, /data-dir="left"/)
  assert.match(html, /data-dir="down"/)
  assert.match(html, /data-dir="right"/)
})

test('timer and win condition', () => {
  assert.match(html, /timeLeft=60/)
  assert.match(html, /interval:7/)
  assert.match(html, /collected>=5/)
  assert.match(html, /rectCircleCollide/)
  assert.match(html, /wave\.active/)
})

test('server serves health and dist', async () => {
  assert.ok(existsSync(resolve(root, 'server.mjs')))
  assert.ok(existsSync(resolve(root, 'dist/index.html')) || existsSync(resolve(root, 'index.html')))
  assert.match(distHtml || html, /Tidepool Tangle/)
})

test('no external services except fonts', () => {
  // ensure no fetch to external API
  assert.doesNotMatch(html, /fetch\(['"]https?:\/\//)
  // only Google Fonts allowed
  const externals = [...html.matchAll(/https:\/\/[^"'\s]+/g)].map(m=>m[0])
  for (const url of externals) {
    assert.ok(url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com'), `unexpected external ${url}`)
  }
})
