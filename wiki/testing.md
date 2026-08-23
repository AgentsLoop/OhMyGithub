# Testing and verification

For an issue-triggered run, verify these checkpoints in order:

1. `Start AgentsWeb SSH session` succeeds.
2. `Post temporary SSH connection command` succeeds.
3. `Verify AgentsWeb SSH availability` succeeds.
4. `Run OpenCode` succeeds.
5. `Mark SSH session closed` and `Clean up AgentsWeb SSH session` succeed.
6. The expected branch and pull request exist.

Validate workflow edits locally with:

```sh
actionlint .github/workflows/opencode.yml
git diff --check
```

The workflow may show non-fatal Node.js deprecation or Actions cache warnings.
