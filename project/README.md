# Crystal Catcher — Catch the Light

Polished browser arcade game where you move a basket to catch falling crystals and dodge bombs.

## Play

- **Move**: `←` `→` or `A` `D` to glide. On mobile, **drag** anywhere on the playfield or hold the `◀` `▶` buttons.
- **Catch** crystals: Blue 10 • Purple 20 • Cyan 30 • Gold 50 (rare, glows)
- **Avoid** bombs: each hit costs a life. 3 lives per run.
- **Level up** every 250 points: fall speed rises, spawn interval shrinks, bomb chance increases.
- **Pause** with `P` / `Space` or the ⏸ button. **Restart** with `R` or the ↻ button.

## Features

- Canvas rendering with 60fps loop, glow/particle bursts, screen shake, and faceted crystal art
- HUD with score, level + progress bar, and hearts
- Game-over overlay with final stats + best score (persisted in localStorage)
- Responsive layout: desktop 2-column (game + how-to-play) and mobile single column with touch controls
- Sound via WebAudio (toggle with 🔊)
- Pure game logic (`src/game.js`) fully unit-tested

## Stack

- Vite 5 + vanilla JS (ES modules)
- Vitest for unit tests
- No build required for logic tests; Vite serves `index.html`

## Project layout

```
project/
  index.html        # markup + HUD + overlays
  src/
    game.js         # pure logic (createInitialState, update, collisions, difficulty)
    main.js         # canvas rendering, input, loop, particles, audio
    style.css       # polished glassmorphism theme + responsive grid
  tests/
    game.test.js    # 26 tests covering collisions, scoring, lives, spawning, levels
  vite.config.js
  package.json
```

## Commands

```sh
npm install
npm test            # vitest run (26 tests)
npm run dev         # vite dev on http://localhost:3000 (tmux: app-server)
npm run build       # production build to dist/
npm run preview     # preview build on :3000
```

The app server is expected to run in a `tmux` session named `app-server` on port 3000 for the verification workflow.

## Core logic contract (`src/game.js`)

- `createInitialState(w,h)` → fresh state
- `moveBasket(state, dir, deltaSec)` / `setBasketPosition(state, xCenter)`
- `spawnObject(state, rand)` / `checkCollision(a,b)`
- `update(state, deltaMs, rand)` → `{caught, bombHits, missed, gameOver}` handles scoring, lives, spawning, and level progression
- `getLevelFromScore / getSpawnInterval / getFallSpeed / getBombChance` drive difficulty

All functions are deterministic when a `rand` is injected, making tests stable.

## License

MIT
