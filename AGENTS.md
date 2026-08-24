# aiplay agent instructions

## Wiki index

- [OpenCode workflow](wiki/opencode.md)
- [Temporary Mac SSH access](wiki/access.md)
- [Testing and verification](wiki/testing.md)

## OpenCode GitHub Actions

The issue-triggered workflow uses `opencode/nemotron-3.5-lightning-free` and the GitHub Actions
token. It does not require an `OPENCODE_API_KEY` repository secret.

Trigger it by commenting `/oc <request>` or `/opencode <request>` on an issue
or pull request. The workflow starts a temporary AgentsWeb SSH session,
verifies it, runs OpenCode, and cleans up the SSH session afterward.

When monitoring a triggered run, use `gh run watch <run-id> --repo agents-dev/aiplay --exit-status` for overall job status.
Do not use `gh run view --log` to read logs from a running task: GitHub reports that
logs are unavailable until completion. Use `bash scripts/ssh-run-log.sh <run-id>`
for the live Actions log over SSH. Do not use tight `for` loops around `gh run list`,
which needlessly consume GitHub API rate limit.

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
