# aiplay agent instructions

## OpenCode GitHub Actions

The issue-triggered workflow uses `opencode/big-pickle` and the GitHub Actions
token. It does not require an `OPENCODE_API_KEY` repository secret.

Trigger it by commenting `/oc <request>` or `/opencode <request>` on an issue
or pull request. The workflow starts a temporary AgentsWeb SSH session,
verifies it, runs OpenCode, and cleans up the SSH session afterward.

## Mac SSH access

The Mac private key stays at `~/.ssh/aiplay-agentsweb`. Its public key is
stored in the repository Actions secret `AGENTSWEB_SSH_PUBLIC_KEY`. The issue
commented by the workflow contains a directly usable command such as:

```sh
ssh -i ~/.ssh/aiplay-agentsweb -p <port> runner@<run-name>.agentsweb.space
```

The command works only while the corresponding Actions job is running.
