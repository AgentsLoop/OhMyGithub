# aiplay agent instructions

## OpenCode GitHub Actions

The issue-triggered workflow uses `opencode/big-pickle` and the GitHub Actions
token. It does not require an `OPENCODE_API_KEY` repository secret.

Trigger it by commenting `/oc <request>` or `/opencode <request>` on an issue
or pull request. The workflow starts a temporary AgentsWeb SSH session,
verifies it, runs OpenCode, and cleans up the SSH session afterward.
