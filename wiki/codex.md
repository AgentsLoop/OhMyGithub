# Run Codex from an issue

Create a new issue with a standalone `#codex` in its title, or attach the
`Codex` label at creation. Use `#codex Build a small game` as a title example.
Use uppercase or lowercase for the Codex tag. Select one agent per issue.
Keep using `/OpenCode` or the `OpenCode` label for OpenCode.

Append `branch: <existing-branch>` to select the checkout and workflow branch.
Install the updated listener on the default branch before opening an issue.
Use the existing `OPENCODE_ACCESS` variable for author access: use `writers`
by default or set `everyone` to accept all issue authors. Use manual dispatch
with an existing issue number to start another run.

## Configure the worker

Set `CODEX_AUTH_JSON` to the complete Codex `auth.json` from a saved ChatGPT
login. Refresh this secret when the saved login expires. Use Codex CLI 0.147.0
for both the app server and terminal client.

Set `CODEX_WEB_CREDENTIAL` to `username:password` to require a terminal login.
Omit this secret to allow browser terminal access without a password.
Set `AGENTSWEB_SSH_PUBLIC_KEY` to also publish a temporary SSH command.

Set `PROJECT_DIR` to a relative project path when needed. Attach `mac` to use
macOS; use Ubuntu by default. Attach one `model/openai/<model>` label to select
a model, or use the Codex default. Attach `skill/<name>` labels to request
shared skills. Reserve `Goal`, `ralph`, `omo`, and `ssh` for OpenCode modes.
Attach `test` to use the committed mock project and real delivery steps.

## Use the terminal

Open the browser terminal URL from the Codex progress comment. Attach to the
existing Codex session and send input there. Reconnect to the same tmux session
after a browser disconnect. Use the SSH command when the optional SSH service
is available.

Let the controller detect the build turn's completion. Follow the terminal
into the forked validation task. Let the workflow check the app entrypoint,
local and public HTTP responses, and screenshot evidence before publishing.
Keep missing screenshot evidence non-blocking. Treat interrupted or failed
turns as failures. Allow a short terminal disconnect during the final source
snapshot, then reconnect after delivery.

Open the project, commit, and release links in the final progress comment.
Read the event transcript and screenshots from the release. Keep generated
screenshots, credentials, and runtime files out of project commits.

Use temporary access for up to five hours after completion, within the
six-hour job limit. Expect cleanup on success, failure, or cancellation.

## Maintain the implementation

Route requests through `.github/workflows/opencode.yml` and its preparation
outputs. Keep Codex execution in `.github/workflows/codex-reusable.yml`.
Use `scripts/codex-services.sh` for service setup and cleanup. Use
`scripts/codex-worker.mjs` for app-server events, validation, and delivery.
Keep the app-server controller and remote terminal client on the same version.
