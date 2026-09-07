# Road-War Arena — Live Progress (Twisted Metal-inspired)

Resumable canonical page. Next agent: read this file first, then `games/road-war-arena/index.html`.

## Research anchors (used to guide build)
1. Cancelled TM battle-royale 3rd-person vehicle combat description — third-person car action, last-standing loop — https://arcader.org/news/never-before-seen-screenshots-show-off-cancelled-twisted-metal-battle-royale/
2. Firesprite third-person vehicle shooter prototype notes (aim + vehicle combat wrap) — https://www.gamescensor.com/screen-catches-never-seen-before-the-battle-of-twisted-metal-canceled-royale/
3. TM PS3-era fast-action cars/guns/destruction + 4-faction blurb — https://www.chaptercheats.com/showvideo/playstation5/619022/twisted-metal-gameplay-video/241775
4. TM 1995 car-info HUD screenshot (health/weapon readout readability anchor) — https://www.mobygames.com/game/4857/twisted-metal/screenshots/playstation/437511/
5. TM screenshot set, post-apocalyptic arena + vehicle silhouettes — https://vgtimes.com/games/twisted-metal/screenshots/
6. TM2 screenshot archive (arena props, industrial junkyard language) — https://www.classic-gaming.net/screenshot/9056/
7. TM4 screenshot set (rust/grime palette, overhead arena readability) — https://retrogamerclassics.com/playstation/twisted-metal-4/screenshots
8. TM PS3 asset set (HUD/weapon icon density reference) — https://www.honestgamers.com/assets/38268/view/0.html

Purposes: (a) visual language = rust, asphalt, concrete, fire, chain-link; (b) interaction = third-person drive + aim + fire + pickups + last-car-standing; (c) HUD = big health, weapon/ammo, enemies-left, minimap.

## Decision / route
Lead route: standalone zero-dependency Canvas 2D arena at `games/road-war-arena/index.html` (no build step, no CDN).
Why: deployable as static file, verifiable with python http + node, no risk to `site/` Vue app, works offline, responsive + touch.

## Completed
- [x] Anchor research (8 URLs above)
- [x] Game file scaffold (single-file, inline CSS/JS)
- [ ] Browser capture + A/B check
- [ ] Responsive + restart/win/lose evidence

## How to run
- `python3 -m http.server 8099 --directory games/road-war-arena` then open http://localhost:8099/index.html
- No install. Test hooks: `window.__arena` exposes state.

## Controls
- WASD/arrows drive, mouse aim, click/Space fire, 1/2/3 weapons, Shift boost, P pause, R restart, M mute.

## Current gaps
- Screenshot A/B vs anchors pending (no headless browser in env yet — try npx playwright screenshot).
- Balance pass pending after playtest.

## Evidence (2026-09-07)
- JS syntax OK (`node --check` on extracted script). HTML parse OK (31076+ bytes). HTTP serve + curl OK.
- Captures: menu 1280x720 + 390x844 readable; gameplay ?autostart renders HUD + arena + pickups + YOU car, no error overlay after ui.getElementById fix; ?win shows VICTORY + ROLL OUT AGAIN + score/best.
- Critic gaps fixed: menu-hide crash (named-globals) fixed, camera init on spawn, mobile topbar horizontal-scroll fix.
- Known gap: night-arena ground still dark vs bright TM2/TM4 anchors; cars readable but small at full-zoom-out. Follow-up: raise ambient + headlights.
- Win/lose/restart: `window.__arena.win/lose/restart/killAll/damage` hooks + ?win/?lose params verified.

## Next exact action
Run `bash games/road-war-arena/verify.sh` (node syntax + http smoke), then capture screenshots at 1280x720 and 390x844, compare HUD/arena readability vs anchors 4/5/7, fix largest gap, commit+push.
