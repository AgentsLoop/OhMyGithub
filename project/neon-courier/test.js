import assert from 'assert';
import fs from 'fs';
const html = fs.readFileSync('index.html','utf8');
const css = fs.readFileSync('style.css','utf8');
const js = fs.readFileSync('main.js','utf8');

// structure checks
assert(html.includes('id="game"'), 'canvas missing');
assert(html.includes('id="score"'), 'score HUD missing');
assert(html.includes('id="timer"'), 'timer missing');
assert(html.includes('id="beacons"'), 'beacons HUD missing');
assert(html.includes('id="status"'), 'status missing');
assert(html.includes('WASD') && html.includes('ARROWS'), 'instructions missing');
assert(html.includes('id="overlay-start"'), 'start overlay missing');
assert(css.includes('@media'), 'responsive missing');
assert(js.includes('GAME_TIME'), 'timer logic missing');
assert(js.includes('BEACON_COUNT'), 'beacon count missing');
assert(js.includes('PULSE'), 'pulse logic missing');
assert(js.includes('exit.open'), 'exit logic missing');
assert(js.includes('setState') || js.includes('state'), 'state handling missing');
assert(js.includes('keys.has'), 'keyboard handling missing');

console.log('All static checks passed');
