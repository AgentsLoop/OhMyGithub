# Oh My Github App

The public GitHub App is owned by the `AgentsLoop` organization and is available
at [Oh My Github App](https://github.com/apps/oh-my-github-app). It is installed
for all current and future repositories in `AgentsLoop`, and can be installed by
other users or organizations because the App is public.

The App has repository metadata read access and Issues read/write access. It
subscribes only to the `Issues` event. Its configured webhook endpoint is
`https://omgithub.com/api/github/webhooks`.

The App also has Actions, Contents, Pull requests, and Workflows read/write
access so it can dispatch/bootstrap the repository-local workflow and create
the generated PR with an installation token. The workflow authenticates its PR
request to `POST /api/github/pull-requests` with its repository-scoped token;
the service verifies the workflow run, `opencode/<run-id>` branch, and exact
commit before minting the installation token. Existing installations must
approve newly requested permissions before those capabilities become active.

## Request routing

The webhook service verifies `X-Hub-Signature-256`, durably claims each
`X-GitHub-Delivery`, ignores unrelated
bot-authored and non-`OpenCode`-labeled issue events, and mints an
installation-scoped token. It
accepts only issue creation with `OpenCode` already present or addition of that
exact label; comments and edits never execute work. It checks
`.github/workflows/opencode.yml` on the selected branch:

When a human opens an issue without the `OpenCode` label, the App adds that
label to the issue and posts `Please add the OpenCode label to this issue to
execute it.` The resulting bot-authored `OpenCode` label event is accepted as
the execution trigger, using the issue author for authorization. A human adding
that exact label later follows the same path.

Webhook redelivery of the same delivery ID is ignored. A short durable
per-issue execution lease closes the separate opened/labeled delivery race,
the App checks queued and in-progress runs, and the reusable job enforces an
issue-scoped concurrency key as the final guard.

An optional issue-title suffix `branch: <existing-branch>` selects the target
checkout and pull-request base. The App removes that metadata suffix from the
OpenCode prompt and validates the branch before routing. Invalid or nonexistent
branches receive an issue comment and stop before dispatch. The App dispatches
the workflow from the selected branch. A repository-owned wrapper therefore
uses the reusable pipeline revision from that branch; a bootstrapped wrapper
continues to call the central pipeline.

Before dispatching or bootstrapping a wrapper, the service verifies that the
installation token has Actions, Contents, Issues, Pull requests, and Workflows
write access. Missing permissions are posted to the triggering issue and the
request stops before an Actions run is created. If Issues write access itself is
missing, the service uses its configured notification token when that token can
access the repository.

- When the dispatch-only file exists, the App dispatches it.
- When the lookup returns 404, the App creates a thin repository-local wrapper
  that calls the centralized reusable workflow, then dispatches that wrapper.
  This keeps the Actions run and logs in the repository containing the `OpenCode`
  issue without copying the pipeline implementation.

Both routes call `.github/workflows/opencode-reusable.yml`. That reusable
workflow is the only copy of the OpenCode build, verification, remediation,
delivery, publishing, reporting, and cleanup pipeline. The local wrapper uses
the repository's `GITHUB_TOKEN`; installation credentials and tokens are never
carried in workflow inputs.

Keep the webhook secret out of the repository and this wiki.
