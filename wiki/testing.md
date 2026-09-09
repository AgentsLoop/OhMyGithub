# Testing and verification

## Test standalone issue access

Test `/OpenCode` in a new issue title with `OPENCODE_ACCESS=everyone` and
verify that Actions adds the execution label and starts one execution job.
Restore the access variable after testing. Verify restricted access with the
variable unset. Read request records from GitHub Actions bot comments.

## Test the `-rc` repository at a selected commit

Use the release-candidate repository when you need to test the workflow against
an older or experimental commit without changing the source repository.

Set the repository and commit variables first:

```sh
repo=AgentsLoop/OhMyGithub-rc
commit=<full-commit-sha>
branch=rc-<short-commit-sha>
```

Create a branch from the exact commit and make it the GitHub default branch:

```sh
git push "https://github.com/$repo.git" "${commit}:refs/heads/$branch"
gh repo edit "$repo" --default-branch "$branch"
gh repo view "$repo" --json defaultBranchRef
```

Keep the existing `main` branch and older test branches. Use a new branch name
for each commit so the tested revision remains clear and recoverable. The
workflow checks out the GitHub default branch when the issue title has no
`branch:` suffix.

Create an SSH test issue with the required labels:

```sh
gh issue create --repo "$repo" \
  --title "Check SSH connectivity on $branch" \
  --body $'# Check SSH connectivity on <branch>\n\nVerify the temporary AgentsWeb SSH session, authentication, tunnel, and remote response. Record concrete evidence without exposing secrets.' \
  --label Goal --label ssh
gh issue edit <issue-number> --repo "$repo" --add-label OpenCode
```

Apply `OpenCode` after listener installation to trigger one native `issues` run. The
`Goal` label selects goal mode. The `ssh` label requests an SSH-only check in
the reusable workflow. Verify the issue labels and the selected checkout:

```sh
gh issue view <issue-number> --repo "$repo" --json labels
gh run list --repo "$repo" --workflow opencode.yml --limit 5 \
  --json databaseId,displayTitle,event,status,url,headBranch
```

Confirm `event` is `issues` and `headBranch` is the default branch.
Check preparation outputs for the selected `target_ref` and `target_sha`.

Discover and follow the temporary SSH connection with the repository helper:

```sh
bash scripts/ssh-run-log.sh <run-id> --repo "$repo"
```

Run the helper while the Actions job is active. It reports no command after the
worker closes the tunnel. If it reports no command at the start, inspect the
run steps and logs before changing the SSH secret. `AGENTSWEB_SSH_ENABLED:
true` proves that GitHub received the public-key secret; it does not prove that
the tunnel or SSH service started.

After testing, restore the normal default branch if required:

```sh
gh repo edit "$repo" --default-branch main
```

Project acceptance testing is live production testing. Manually create a real
GitHub issue with the required labels and prompt, then verify the resulting
issue run, exactly one execution runner/session, and the completed production
outcome. Do not use unit tests as the testing strategy; local checks such as
`actionlint` and `git diff --check` are only static safeguards before the live
test.

For an issue-triggered run with `AGENTSWEB_SSH_PUBLIC_KEY` configured, verify
these checkpoints in order:

1. `Start AgentsWeb SSH session` succeeds.
2. `Post temporary SSH connection command` succeeds.
3. `Verify AgentsWeb SSH availability` succeeds.
4. `Run OpenCode` succeeds.
5. `Mark SSH session closed` and `Clean up AgentsWeb SSH session` succeed.
6. The expected branch and immutable commit exist.

The verification loop must confirm a browser entrypoint before public-app and
Pages checks: either `$PROJECT_DIR/index.html` or `$PROJECT_DIR/dist/index.html`
must exist, and remediation retries must repeat that check. Static root
`index.html` apps are copied to a temporary Pages directory; built
`dist/index.html` apps are published directly.

When `AGENTSWEB_SSH_PUBLIC_KEY` is missing, the SSH session and SSH-based
verification steps must be skipped. OpenCode Web, the Cloudflare session URL,
and the browser-based workflow path must still run; the access comment should
omit SSH instructions and cleanup must not report an SSH session closure.

The AgentsWeb public port must be derived from `GITHUB_RUN_ID`, not
`GITHUB_RUN_NUMBER`. Run numbers restart at `1` for each repository, which made
the first OMG run in every newly installed repository contend for port `32001`
and close during SSH verification. The globally unique run ID spreads those
runs across the broker's `32000-32999` port range.

Validate workflow edits locally with:

```sh
actionlint .github/workflows/opencode.yml .github/workflows/opencode-prepare.yml .github/workflows/opencode-reusable.yml
git diff --check
```

For a full workflow test, apply both the `OpenCode` and `test` labels to an
issue. Apply `OpenCode` after `test`; `test`
selects a deterministic mock-generation path. The workflow copies the fixture
from `.github/fixtures/test-project` instead of invoking OpenCode, then verifies
it locally, creates and pushes the normal branch, reports the immutable
OmGithub tree URL, and completes the issue. Opening that URL must generate the
store page and playable deployment without credentials. The test path does not keep a
temporary worker alive for five hours.
The issue must still receive the normal live-progress comment and final report,
plus the completion report comment, and the run must publish a logs release
containing the synthetic OpenCode transcript plus the real validation and
delivery logs.

The caller must grant every permission requested by the reusable workflow.
Otherwise GitHub rejects the run at startup before creating a job, even when
`actionlint` succeeds.

For goal support, create an issue with `Goal`, then add `OpenCode`. Verify one
native `issues` run, successful preparation, and the Goal invocation. Verify
that an issue without `Goal` uses the standard invocation. Preserve `Goal`
when adding lifecycle labels.

For Ralph support, create an issue with `OpenCode` and `ralph` labels and
confirm the workflow installs `opencode-ralph-loop`, invokes
`opencode run --command ralph-loop`, and preserves the same OpenCode session.
The build is accepted only when the session emits
`<promise>DONE</promise>`; a missing promise must not receive the `complete`
label. If both `Goal` and `ralph` are present, Ralph takes precedence.

For custom-branch support, append `branch: <existing-branch>` to the title.
Verify preparation strips routing metadata, resolves the branch, and supplies
a frozen commit to checkout. Reject invalid or missing branches before execution.
Verify workflow code comes from the default branch.

For the `omo` issue label, verify that an otherwise normal OpenCode issue causes
the OpenCode startup step to install `oh-my-openagent` with Bun before starting
the web server and launches `opencode ... --command goal` with `ulw` in the
objective; an issue without the `OpenCode` label must not run that installer, and the
`omo` label alone must not trigger a workflow. The OMO config must use its
native Goal command and must not register a compatibility `ulw-loop` command.

The log-release step must copy and upload only non-empty `.log`/`.json` files;
empty service logs such as `nginx.log` can make GitHub's upload API return
`400 Bad Content-Length`. The OpenCode response JSON remains required and must
be non-empty.

Focused completion-evidence checks should also confirm that the workflow copies
`.github/templates/agents.template.md` to `Agents.md` and appends every
label-matched template, then forks the completed build session
before verification, and sends up to two follow-up prompts to that verification
session when no `screenshots/final-*` image exists, with three total
evidence checks. Missing screenshots warn and do not block delivery; when present,
a successful run must leave a final issue comment
containing the Open Project URL, final commit, and embedded screenshots served
from that immutable commit.

Watch a running workflow with live per-step logs using the same internal
endpoints as the GitHub Actions web UI:

```sh
python3 scripts/gh-run-watch-logs.py <run-id> \
  --repo AgentsLoop/OhMyGithub --internal-job-id <web-job-id> --exit-status
```

The script authenticates with `gh auth token`. GitHub's web log endpoints are
unsupported and may change. Unlike `gh run view --log`, they expose the
currently available text while a job is running. GitHub does not expose the
web UI's second, internal job ID through its supported API. Read it from the
job page's `data-job-steps-url`, whose form is
`.../actions/runs/<run>/jobs/<web-job-id>/steps`.

In the browser console on the job page, print that URL with:

```js
document.querySelector("check-steps").dataset.jobStepsUrl
```

The workflow may show non-fatal Node.js deprecation or Actions cache warnings.

For the freshest local log, connect to the temporary SSH session posted by the
workflow and follow the runner's current page log:

```sh
find /home/runner/actions-runner/cached/*/_diag/pages -type f -name '*_1.log' -print
tail -F /home/runner/actions-runner/cached/*/_diag/pages/*_1.log
```

The runner writes the live Actions console output to `_diag/pages` and uploads
step-log chunks from `_diag/blocks`. This can be ahead of `gh run view --log`
while a job is still running. Avoid printing environment files, tokens, or keys.

Use the helper to discover the posted SSH endpoint automatically:

```sh
bash scripts/ssh-run-log.sh <run-id>
```

The helper checks the AgentsWeb broker `/api/registrations` endpoint first when
`BROKER_API_TOKEN` is available (or when `../../sshworker/workers-dashboard/.env`
contains it), then falls back to the workflow issue comments.

## Test the local SSH tunnel service

Run the raw tunnel health check from the `sshworker` checkout. Set `PYTHONPATH`
to the checkout because the test imports the local `lolgames_tunnel` package:

```sh
PYTHONPATH=/Users/igor/Documents/sshworker \
  /Users/igor/Documents/sshworker/tests/test-ssh-tunnel.sh
```

Interpret the output in this order:

- `PASS control TCP` confirms that the local machine can reach the broker
  control port.
- `PASS local SSH listener` confirms that the local SSH service is listening.
- `PASS registered` and `PASS SSH host-key exchange` confirm the complete
  public tunnel path.

If the test reports `No module named lolgames_tunnel`, set `PYTHONPATH` as
shown above. Do not treat that error as a broker outage. If the module-path
fix is present and registration still fails, inspect the client error output
and then check the broker service.
