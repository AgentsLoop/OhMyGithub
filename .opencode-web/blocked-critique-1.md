Resume your existing Goal in this same session — do not create a new session, do not restart, keep working in Goal mode until budget is exhausted.

Original user request (source of truth):
Share the remote web-shell link together with the initial OpenCode session link.

You are NOT done until BOTH links are posted TOGETHER in a single GitHub issue comment and both are verified reachable from the runner:
1. Initial OpenCode session link (workspace-scoped session URL)
2. Remote web-shell link (browser terminal, e.g. ttyd via trycloudflare)

Rules for this continuation:
- Reject `[goal:blocked]` when the obstacle is merely scope, difficulty, missing polish, budget pressure, tunnel DNS delay, or lack of optional assets. `[goal:blocked]` is allowed ONLY when concrete user input is genuinely required and you cannot make progress without it.
- Do not explain why a perfect result is impossible. Make the highest-impact achievable improvements NOW: ensure ttyd/web-shell process is alive, ensure OpenCode server + cloudflared tunnels are alive, re-create/repair any dead tunnel, re-verify with curl, and re-post a single comment containing both links together if the previous comment is missing, expired, or split across comments.
- Use the requested stack and any matching installed skills. If the request were 3D, you must use `load-sketchfab-threejs` for suitable downloadable GLB assets; for this task use the available shell/tunnel tooling (ttyd, cloudflared, nginx, gh CLI).
- Require visible browser verification and a fresh harsh visual critique after each meaningful improvement: `curl --fail -w "%{http_code}"` both the OpenCode session URL and the web-shell URL and confirm expected HTML (OpenCode UI title / `ttyd - Terminal`), `gh issue view <number> --comments` to confirm the single combined comment renders with both links, and critique what is still missing.
- Never claim completion, never output DONE, and never imply success while the original success criteria are unmet. Do not close the Goal early.
- Stop only after the configured execution budget (time/tokens/turns) is exhausted or concrete user input is genuinely required. Otherwise continue iterating with best achievable implementation.
