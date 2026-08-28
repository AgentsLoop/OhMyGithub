# aiplay agent instructions

## Wiki index

- [OpenCode workflow](wiki/opencode.md)
- [Temporary Mac SSH access](wiki/access.md)
- [Testing and verification](wiki/testing.md)

## Main project file

The main project file is [.github/workflows/opencode.yml](.github/workflows/opencode.yml).
In issue comments and workflow instructions, `oc` means OpenCode.

## Git delivery

After every code change, commit and push the change.
Before running any workflow, verify that the working tree is clean and everything
is committed.

When the user asks to undo a just-made change or commit, inspect the targeted
commit and working tree first, then prefer rewriting that commit and pushing with
`git push --force-with-lease` rather than creating a revert commit. Preserve
unrelated changes and stop if the remote branch has advanced unexpectedly. Use
`git revert` when the change is already shared broadly or when history rewriting
would be unsafe.

## Git Commits
- Write evidence-rich commit messages, not short subject-only messages. Use a specific subject and a body that records the motivating symptom or context, root cause, decision rationale and alternatives considered, material changes, verification performed, discovered Throughput bottlenecks or Hung commands, relevant Pitfalls and Gotchas, and known caveats or follow-up. Preserve the durable reasoning summary needed for diagnosis, rollback, and future extension.
- Always include the current Codex chat/task ID in the commit message, using a clear field such as `Chat-ID: <chat-id>` in the body.

## Links in handoffs

When a relevant URL or stable identifier exists, include a clickable Markdown
link in the user-facing response. Link GitHub issues, Actions runs, pull
requests, commits, releases, public app URLs, and Codex tasks/threads rather
than reporting only their numbers or plain text. For Codex tasks/threads, use
the `codex://threads/<thread-id>` URL format.

When mentioning a commit, append its relative age in hours or days.

## OpenCode GitHub Actions

The issue-triggered workflow uses `opencode/muse-spark-1.2-contributor-free` and the GitHub Actions
token. It does not require an `OPENCODE_API_KEY` repository secret. When workflow steps call
the GitHub API, use the authenticated `GITHUB_TOKEN`; do not rely on unauthenticated API requests.

Trigger it by commenting `/oc <request>` or `/opencode <request>` on an issue
or pull request. The workflow starts a temporary AgentsWeb SSH session,
verifies it, runs OpenCode, and cleans up the SSH session afterward.

When monitoring a triggered run, use `gh run watch <run-id> --repo agents-dev/aiplay --exit-status` for overall job status.
Do not use `gh run view --log` to read logs from a running task: GitHub reports that
logs are unavailable until completion. Use `bash scripts/ssh-run-log.sh <run-id>`
for the live Actions log over SSH. Do not use tight `for` loops around `gh run list`,
which needlessly consume GitHub API rate limit.

To connect to an issue's live worker, find its run ID with
`gh run list --repo agents-dev/aiplay --workflow opencode.yml --status in_progress`,
then run `bash scripts/ssh-run-log.sh <run-id>` to discover the host and port and SSH
with `~/.ssh/aiplay-agentsweb` as shown by the helper.

When the user asks to check a live OpenCode workflow, always pull the runner logs
over SSH first, using `scripts/ssh-run-log.sh` or a targeted SSH read from the
same runner. Base the answer on those logs before discussing whether an action
is confirmed; do not lead with a generic inability-to-confirm statement when
live log evidence can be collected.

For real-time inspection from a live temporary SSH session, use the helper:

```sh
bash scripts/ssh-run-log.sh <run-id>
```

The helper discovers the temporary SSH command from the triggering issue or pull
request, then follows the freshest `_diag/pages` log. The runner uploads chunks from
`_diag/blocks` to GitHub. Do not print environment files, tokens, or private keys while
inspecting the runner.

## Mac SSH access

The Mac private key stays at `~/.ssh/aiplay-agentsweb`. Its public key is
stored in the repository Actions secret `AGENTSWEB_SSH_PUBLIC_KEY`. The issue
commented by the workflow contains a directly usable command such as:

```sh
ssh -i ~/.ssh/aiplay-agentsweb -p <port> runner@<run-name>.agentsweb.space
```

The command works only while the corresponding Actions job is running.

## Connecting to a live OpenCode worker

Use the repository helper to discover the worker host and port from the broker
or issue comment. It uses the persistent local key `~/.ssh/aiplay-agentsweb`:

```sh
bash scripts/ssh-run-log.sh <run-id> --repo agents-dev/aiplay
```

For an interactive shell, reuse the host and port printed by the helper and
use the same key:

```sh
ssh -tt -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null \
  -i ~/.ssh/aiplay-agentsweb \
  -p <port> runner@<run-name>.agentsweb.space
```

Do not substitute the generated runner key under `sshworker/outputs/keys/`; it
can produce a misleading `Permission denied (publickey)` result. Temporary
worker SSH access ends when the Actions job and session are cleaned up. Never
print secrets while inspecting a worker.
