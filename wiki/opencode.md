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
4. Posts the temporary SSH command and web URL to the triggering issue or pull request.
5. Verifies SSH connectivity.
6. Configures the `opencode[bot]` Git identity.
7. Runs `opencode/big-pickle` and allows it to push a branch and open a PR.
8. Keeps SSH and the web UI available for 30 minutes after the prompt ends,
   then marks the comment closed and terminates both tunnels.

The workflow uses the built-in OpenCode model path and does not require an
`OPENCODE_API_KEY` secret.

## Required repository settings

- Actions must be allowed to create and approve pull requests.
- The `AGENTSWEB_SSH_PUBLIC_KEY` Actions secret must contain the public key
  matching the Mac private key described in [access.md](access.md).
