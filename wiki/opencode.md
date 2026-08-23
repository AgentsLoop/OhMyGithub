# OpenCode GitHub workflow

The canonical workflow is `.github/workflows/opencode.yml`.

## Trigger

Comment `/oc <request>` or `/opencode <request>` on an issue or pull request.
Bot-authored comments are ignored, so status comments do not recurse.

## What the job does

1. Checks out the repository with persisted `GITHUB_TOKEN` credentials.
2. Starts an ephemeral AgentsWeb SSH tunnel.
3. Starts the OpenCode web UI and publishes it through a temporary public
   trycloudflare.com tunnel.
4. Starts `opencode github run` against the same OpenCode installation and
   server-backed session store, then posts a direct URL to that live session.
5. Verifies SSH connectivity.
6. Configures the `opencode[bot]` Git identity.
7. Runs `opencode/big-pickle` and allows it to push a branch and open a PR.
8. Keeps SSH and the web UI available for 30 minutes after the prompt ends,
   then marks the comment closed and terminates both tunnels.

The comment URL opens `/<encoded-worktree>/session/<session-id>` rather than
the web home page. This matters because the web home page stores its project
selection in the browser, while the runner's project exists only on the
temporary GitHub Actions filesystem.

The workflow uses the built-in OpenCode model path and does not require an
`OPENCODE_API_KEY` secret. The upstream composite action is copied to
`.github/actions/opencode-github/action.yml`; its run phase is modified to
expose the session ID and direct Web UI URL before waiting for completion.

## Findings: tracking the GitHub run in Web UI

`anomalyco/opencode/github@latest` is a composite action. It installs the
OpenCode CLI and runs:

```sh
opencode github run
```

The GitHub command creates a regular OpenCode session through the shared
session services and sends the GitHub prompt through that session. Replacing
the action is therefore not required just to obtain a Web UI session.

The Web UI still needs to be connected to the same project. OpenCode's server
loads project instances per request using the `x-opencode-directory` header.
A tunneled browser request does not know the runner's `$GITHUB_WORKSPACE`, so
the UI can appear empty even while `opencode github run` is actively working.

The reliable architecture is:

```text
opencode github run
        |
        v
shared OpenCode session/database
        ^
        | x-opencode-directory: $GITHUB_WORKSPACE
        |
local header-injecting proxy
        ^
        |
trycloudflare tunnel -> browser Web UI
```

The workflow tunnels a minimal local nginx reverse proxy that injects
`x-opencode-directory: $GITHUB_WORKSPACE` before forwarding requests to
OpenCode Web, including WebSocket upgrade headers. The access comment points
to the encoded worktree/session route, so the browser opens the live run
directly. A loaded Web UI or healthy tunnel alone does not prove session
tracking; acceptance requires a screenshot while the run is active.

## Required repository settings

- Actions must be allowed to create and approve pull requests.
- The `AGENTSWEB_SSH_PUBLIC_KEY` Actions secret must contain the public key
  matching the Mac private key described in [access.md](access.md).
