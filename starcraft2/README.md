# StarCraft 2 Mini-RTS

Browser RTS inspired by StarCraft 2 (Terran vs Zerg-like swarm).

## Play

Open `starcraft2/index.html` directly, or serve the repo and visit `/starcraft2/`:

```sh
python3 -m http.server 8000
# open http://localhost:8000/starcraft2/
```

## Features

- Resource economy: minerals + vespene-like gas, SCV harvest loop with carry/return
- Base building: Command Center, Supply Depot (+8 supply), Barracks (unlocks Marines)
- Production queue with build times, supply cap gating
- RTS controls: drag-box select, right-click smart orders (move / harvest / attack), build placement, hotkeys (A/B/S/Esc)
- Combat: range, cooldowns/DPS, HP bars, auto-acquire, kill counter
- Enemy AI: defends hive, sends growing attack waves on a timer
- Win/loss: destroy enemy Command Center (win) / lose yours (loss), restart overlay
- HUD: resources, supply, queue, timer, kills, minimap, camera follow

## Tests

Pure sim lives in `game-logic.mjs` (no DOM) so it runs in Node:

```sh
node --test starcraft2/game-logic.test.mjs
```
