import assert from 'assert';
import fs from 'fs';
const html = fs.readFileSync('index.html','utf8');
const css = fs.readFileSync('style.css','utf8');
const js = fs.readFileSync('main.js','utf8');

assert(html.includes('id="game"'), 'canvas missing');
assert(html.includes('id="score"'), 'score HUD missing');
assert(html.includes('id="timer"'), 'timer missing');
assert(html.includes('id="caught"'), 'caught HUD missing');
assert(html.includes('id="missed"'), 'missed HUD missing');
assert(html.includes('id="overlay-start"'), 'start overlay missing');
assert(html.includes('btn-start'), 'start button missing');
assert(html.includes('btn-restart'), 'restart missing');
assert(css.includes('@media'), 'responsive missing');
assert(js.includes('GAME_TIME'), 'timer logic missing');
assert(js.includes('spawnFirefly') || js.includes('fireflies'), 'firefly logic missing');
assert(js.includes('CATCH_R') || js.includes('catch'), 'catch logic missing');
assert(js.includes('missed'), 'miss feedback missing');
assert(js.includes('keys.has') || js.includes('mouse'), 'controls missing');
assert(js.includes('setState') || js.includes('state'), 'state handling missing');

console.log('All static checks passed');
