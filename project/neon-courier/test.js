import assert from 'assert';
import fs from 'fs';
const html = fs.readFileSync('index.html','utf8');
const css = fs.readFileSync('style.css','utf8');
const js = fs.readFileSync('main.js','utf8');

// structure checks - Lantern Catch
assert(html.includes('id="game"'), 'canvas missing');
assert(html.includes('id="score"'), 'score HUD missing');
assert(html.includes('id="timer"'), 'timer missing');
assert(html.includes('id="caught"'), 'caught HUD missing');
assert(html.includes('id="missed"'), 'missed HUD missing');
assert(html.includes('id="overlay-start"'), 'start overlay missing');
assert(html.includes('id="overlay-end"'), 'end overlay missing');
assert(css.includes('@media'), 'responsive missing');
assert(js.includes('GAME_TIME'), 'timer logic missing');
assert(js.includes('fireflies') || js.includes('firefly'), 'firefly logic missing');
assert(js.includes('lantern'), 'lantern logic missing');
assert(js.includes('spawnFirefly') || js.includes('spawn'), 'spawn logic missing');
assert(js.includes('miss'), 'miss feedback missing');
assert(js.includes('setState') || js.includes('state'), 'state handling missing');
assert(js.includes('keys.has') || js.includes('mouse'), 'input handling missing');
assert(js.includes('60'), '60s timer missing');
assert(html.includes('LANTERN CATCH') || html.includes('Lantern Catch'), 'title missing');
assert(js.includes('hitFlash') || js.includes('shake') || js.includes('missShake'), 'feedback effects missing');

console.log('All static checks passed');
