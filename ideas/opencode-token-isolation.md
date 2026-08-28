# Isolate OpenCode GitHub credentials

Status: proposal only. This document does not change the workflow.

## Goal

Prevent the OpenCode worker from pushing directly to `main` or arbitrary
branches, while preserving issue statistics, progress updates, and trusted
workflow delivery.

## Recommended design

The worker should not receive the write-capable `GITHUB_TOKEN` or `GH_TOKEN`:

1. Remove the job-level `GH_TOKEN` from `.github/workflows/opencode.yml`.
2. Set `persist-credentials: false` on the repository checkout.
3. Provide the token only to trusted runner-side steps that update issue status,
   push the generated branch, or create the pull request.
4. If OpenCode needs issue metadata, fetch it on the runner and pass the data to
   the agent, or provide a separate read-only credential.

## Acceptance criteria

- OpenCode can edit and test the project normally.
- The worker cannot authenticate a Git push to `main` or another branch.
- Issue statistics and progress/status comments continue working.
- The trusted runner can push only the generated `opencode/<run-id>` branch and
  create its pull request.
- No token is exposed through inherited environment variables, Git credential
  files, command-line arguments, or generated OpenCode configuration.
