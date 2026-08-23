# OpenCode GitHub workflow

The canonical workflow is `.github/workflows/opencode.yml`.

## Trigger

Comment `/oc <request>` or `/opencode <request>` on an issue or pull request.
Bot-authored comments are ignored, so status comments do not recurse.

## What the job does

1. Checks out the repository with persisted `GITHUB_TOKEN` credentials.
2. Starts an ephemeral AgentsWeb SSH tunnel.
3. Posts the temporary SSH command to the triggering issue or pull request.
4. Verifies SSH connectivity.
5. Configures the `opencode[bot]` Git identity.
6. Runs `opencode/big-pickle` and allows it to push a branch and open a PR.
7. Marks the SSH comment closed and terminates the tunnel.

The workflow uses the built-in OpenCode model path and does not require an
`OPENCODE_API_KEY` secret.

## Required repository settings

- Actions must be allowed to create and approve pull requests.
- The `AGENTSWEB_SSH_PUBLIC_KEY` Actions secret must contain the public key
  matching the Mac private key described in [access.md](access.md).
