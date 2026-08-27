export function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
export function lerp(a,b,t){ return a+(b-a)*t; }
export function formatAmmo(mag,reserve){ return `${mag} / ${reserve}`; }
export function isHeadshot(hitY, enemyH){ return hitY > enemyH*0.65; }
export const GAME_CONFIG = { magSize:30, reserve:90, maxHealth:100, killsToWin:10, enemyHP:100, headshotMult:2, shootCooldown:110, reloadMs:1350 };
