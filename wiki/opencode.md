# OpenCode GitHub workflow

The canonical workflow is `.github/workflows/opencode.yml`.

## Trigger

`/oc <request>` or `/opencode <request>` can appear in a newly created or
edited issue/PR title or body, an issue comment, or a pull-request review
comment. Bot-authored events are ignored, so status comments do not recurse.

## What the job does

1. Checks out the repository with persisted `GITHUB_TOKEN` credentials.
2. Starts an ephemeral AgentsWeb SSH tunnel.
3. Starts the OpenCode web UI and publishes it through a temporary public
   trycloudflare.com tunnel.
4. Creates an `opencode/<run-id>` branch from the relevant base branch.
5. Starts `opencode run --attach` against the same OpenCode installation and
   server-backed session store, then posts a direct URL to that live session.
6. Verifies SSH connectivity.
7. Waits for OpenCode, pushes the branch, and creates the pull request in YAML.
8. Keeps SSH and the web UI available for 30 minutes after the prompt ends,
   then marks the comment closed and terminates both tunnels.

The comment URL opens `/<encoded-worktree>/session/<session-id>` rather than
the web home page. This matters because the web home page stores its project
selection in the browser, while the runner's project exists only on the
temporary GitHub Actions filesystem.

The workflow uses the built-in OpenCode model path and does not require an
`OPENCODE_API_KEY` secret. Branch creation, pushing, and pull-request creation
are deliberately handled by the workflow rather than by OpenCode's GitHub
integration.

## Findings: tracking the GitHub run in Web UI

The previous GitHub integration installed the OpenCode CLI and ran:

```sh
opencode github run
```

The workflow now sends the comment text directly to `opencode run --attach`.
This keeps the regular OpenCode session while making branch and PR behavior
explicit and reviewable in YAML.

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
