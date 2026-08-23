# aiplay

An OpenCode-enabled project.

Use `/opencode <request>` or `/oc <request>` in an issue or pull-request comment to ask OpenCode to inspect, explain, or change the code.

## Tetris app

A playable browser Tetris game lives in this repository: vanilla JS game
logic (`src/tetris.js`), canvas UI (`src/main.js`, `index.html`,
`styles.css`), and a tiny static file server (`server.js`).

```sh
npm install        # installs Playwright (dev dependency for browser tests)
npm start          # serve http://127.0.0.1:8080/
npm test           # logic tests + Playwright browser verification
```

Controls: arrow keys move/rotate, Down soft-drops, Space hard-drops,
P pauses, R restarts. Start/Pause/Restart buttons are also available.
