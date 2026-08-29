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

For goal support, confirm the workflow trigger checks `/omg`, reads the `/Goal`
label without subscribing to `issues: labeled`, installs and configures
`opencode-goal-plugin`, and branches the
initial invocation to `opencode run --command goal` only when that label is on
the issue. An unlabelled `/omg` request must retain the standard `opencode run`
path. The configured
`noInterruptOnUserMessage: true` option should remain visible in the generated
OpenCode config.

Verify that label synchronization creates `/Goal`, and that `Mark issue in
progress` preserves the label alongside `in progress`. `/Goal` must be the only
way an `/omg` request enters goal mode; `/goal`, `/oc`, and `/opencode` must not
trigger the workflow. Creating an issue with both `/omg` and `/Goal` must start
one `issues: opened` run, not separate `opened` and `labeled` runs.

For the `omo` issue label, verify that an otherwise normal `/omg` request causes
the OpenCode startup step to install `oh-my-openagent` with Bun before starting
the web server and launches `opencode ... --command goal` with `ulw` in the
objective; an unlabelled `/omg` request must not run that installer, and the
`omo` label alone must not trigger a workflow. The OMO config must use its
native Goal command and must not register a compatibility `ulw-loop` command.

The log-release step must copy and upload only non-empty `.log`/`.json` files;
empty service logs such as `nginx.log` can make GitHub's upload API return
`400 Bad Content-Length`. The OpenCode response JSON remains required and must
be non-empty.

Focused completion-evidence checks should also confirm that the workflow copies
`agents.template.md` to `project/Agents.md`, and that a run sends up to two
same-session follow-up prompts when no `project/screenshots/final-*` image
exists, with three total evidence checks. Missing screenshots warn and do not
block delivery; when present, a successful run must leave a final issue comment
containing the public URL, final commit, PR, and embedded screenshots served
from that immutable commit.

Watch a running workflow with live per-step logs using the same internal
endpoints as the GitHub Actions web UI:

```sh
python3 scripts/gh-run-watch-logs.py <run-id> \
  --repo agents-dev/aiplay --internal-job-id <web-job-id> --exit-status
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
