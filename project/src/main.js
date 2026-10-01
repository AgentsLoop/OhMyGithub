import { Game } from './game.js';

const game = new Game();
game.init();

window.__runwayRift = game;

// expose for critics QA
window.addEventListener('error', e=>{
  console.error('[RunwayRift] window error', e.message);
});
window.addEventListener('unhandledrejection', e=>{
  console.error('[RunwayRift] unhandled', e.reason);
});
