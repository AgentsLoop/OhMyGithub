---
name: game-issue-e2e
description: Test the issue-triggered game workflow by creating a new game issue, waiting for both OpenCode prompts, and validating the resulting PR and public app tunnel.
---

# Game issue end-to-end test

Use this skill when the user asks to test the game workflow with a new game,
create a game issue, or verify that the `/oc` follow-up workflow works.

## Required outcome

The test is complete only when all of these are true:

- A fresh GitHub issue was created with `/oc` in its title or body.
- The `issues` event triggered `.github/workflows/opencode.yml`.
- The workflow completed successfully.
- The build prompt and the verification prompt both ran. Confirm this from
  the run's completed steps and, when needed, the runner log through the
  temporary SSH command.
- The workflow posted a verified application `trycloudflare.com` URL after
  the verification step, not only the OpenCode Web UI URL.
- A pull request was created from the generated `opencode/<run-id>` branch.
- The PR is clean and its exact head commit passes the repository's unit and
  browser tests.
- The public application URL responds successfully while the temporary tunnel
  is still alive.

## Procedure

1. Confirm `gh auth status` and identify the repository with `gh repo view`.
2. Create a new issue with `gh issue create`. Put `/oc` in the title or body;
   do not add a comment because this specifically tests the `issues` trigger.
   Ask for a concrete playable game and include its functional requirements.
3. Locate the newest `opencode.yml` run with:

   ```sh
   gh run list --workflow opencode.yml --limit 5 --json databaseId,displayTitle,event,status,url
   ```

   Confirm its event is `issues` and its title matches the new issue. Monitor
   it with `gh run watch <run-id> --exit-status --repo <owner>/<repo>`.
4. After completion, inspect the job steps. Require success for `Run OpenCode
   and locate its web session`, `Verify app with second OpenCode prompt`,
   `Expose verified app`, `Create pull request`, and `Post verified app URL`.
   Do not treat the first OpenCode Web UI URL as the app URL.
5. Read the issue comments and extract the final comment containing
   `Verified app is live`. Validate that URL with `curl --fail --max-time 20`.
6. Find the PR whose head is `opencode/<run-id>`. Check its state and merge
   status, then fetch the exact head commit into an isolated temporary
   worktree. Run `npm ci`, `npm test`, and any project-specific runtime check.
   Remove the temporary worktree after the test.
7. Report the issue, run, PR, both-prompt evidence, app URL, and test results.
   If the run is still active, report exactly which step is active and do not
   claim the app is complete.

## Safety and scope

This skill intentionally creates a real issue and starts a real GitHub Action.
Use it only when the user explicitly requests an end-to-end workflow test.
Never cancel or rerun an active test without checking its current step first.
Keep unrelated worktree changes untouched.
