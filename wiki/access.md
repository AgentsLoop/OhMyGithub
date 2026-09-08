# Temporary Mac SSH access

The workflow authorizes the Mac public key stored in the
`AGENTSWEB_SSH_PUBLIC_KEY` repository secret. Keep the matching private key
only on the Mac at:

```text
~/.ssh/aiplay-agentsweb
```

This SSH path is optional. If the repository secret is missing, or tunnel setup
fails, the workflow skips AgentsWeb SSH setup/verification while keeping the
OpenCode Web session available through its browser URL.

When a run is active, the workflow posts a command like this to the triggering
issue:

```sh
ssh -i ~/.ssh/aiplay-agentsweb -p <port> runner@<run-name>.agentsweb.space
```

The command is valid only while that Actions job is running. When setup
succeeds, the workflow verifies the same tunnel and removes the runner SSH
authorization and tunnel during cleanup. The issue access comment includes the
SSH URL together with the OpenCode Web URL. If tunnel setup fails, the comment
reports `SSH URL: not registered`.

If the command stops working, check the Actions run first. A completed or
cancelled run has already closed the tunnel.
