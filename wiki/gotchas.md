# Runner log gotchas

These notes describe the behavior of `scripts/ssh-run-log.sh` and the
temporary Actions runner it connects to.

## Discovery

- The helper accepts a numeric Actions run ID only. Use the numeric ID from
  the Actions URL, not the workflow name or job ID.
- Broker discovery is attempted only when `BROKER_API_TOKEN` is set or the
  current working directory makes `../../sshworker/workers-dashboard/.env`
  resolve to the expected sibling checkout. The `.env` lookup is relative to
  the caller's working directory, not the script directory.
- Broker lookup failures are intentionally silent and fall back to GitHub
  issue comments. A missing token, expired registration, or an unavailable
  broker therefore looks like a normal fallback.
- The comment fallback fetches only the first 100 issue comments and expects a
  command containing `-i <key> -p <port> runner@<host>` on one line. A changed
  command format, pagination, or a wrapped line can make a live session look
  undiscoverable.
- If multiple matching registrations or comments exist, broker discovery uses
  the first match and comment discovery uses the last match. Validate the host
  and port in the diagnostic line before relying on the connection.

## Remote log selection

- The remote path currently includes the pinned runner cache version
  `cached/2.336.0`. If the runner image changes that version, the helper can
  fail with “No non-empty Actions page log found” even though the SSH session
  works. The manual recovery is to inspect
  `/home/runner/actions-runner/cached/*/_diag/pages` and find the current
  version.
- `find ... -print -quit` chooses the first non-empty `*_1.log`, not
  necessarily the newest or currently active page log. If output is stale,
  list all candidates and select the most recently modified log before using
  `tail -F`.
- `_diag/pages` is the useful live console stream. `_diag/blocks` contains
  uploaded chunks and may be the better source when a page log is rotated or
  incomplete. GitHub's regular `gh run view --log` is generally unavailable
  until the job finishes.
- `tail -F` is intentionally long-running. Stop it with Ctrl-C; an SSH exit
  or a closed workflow is expected when the temporary session is cleaned up.

## Timing and lifecycle

- The SSH endpoint exists only while the workflow's temporary AgentsWeb
  session is alive. A valid issue comment or broker registration can become
  stale during cleanup.
- The helper does not wait for the workflow to post access details. If it
  reports that no command was found, retry after the access comment appears.
- A successful SSH connection proves runner access and log availability, not
  that OpenCode, the app, public verification, or the pull request succeeded.
  Use the live log and the workflow result for those separate checkpoints.
- The helper uses `ConnectTimeout=20`, disables host-key persistence, and
  connects as `runner`; it is suitable for ephemeral diagnostics, not for
  establishing a trusted long-lived host identity.

## Safe inspection

- Do not print runner environment files, shell history, private keys, or full
  secrets while diagnosing a run. Prefer targeted `grep`, `jq` count/status
  queries, and selected log tails.
- When a live OpenCode session is being checked, use the SSH runner log first
  so the answer is based on the runner's actual state. Then use a targeted SSH
  command for session/API details if needed.
- If a later step needs the OpenCode API, remember that it is bound to the
  runner's loopback interface. Query it over the same SSH session and include
  the `x-opencode-directory` header with the runner's project path.
