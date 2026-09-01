# OMG (Oh My GitHub) workflow

The canonical workflow is `.github/workflows/opencode.yml`.
The numbered build, verification, remediation, completion, and screenshot
prompt templates are stored as Markdown files in `.github/prompts/`.

## Trigger

The `OpenCode` issue label is the execution marker consumed by the Oh My Github
App. The App dispatches `.github/workflows/opencode.yml`; the workflow itself
accepts only `workflow_dispatch` and does not subscribe directly to issue
events. The issue body, or title when the body is empty, supplies the request
text. Comments and edits never trigger execution. An issue with the `Goal` label
uses the installed `opencode-goal-plugin`, configures
`noInterruptOnUserMessage: true`, and starts the runner with `opencode run
--command goal`; an issue without `Goal` uses the standard `opencode run`
path. The `OpenCode` label asks the App to launch the workflow; add `Goal` to select
persistent goal mode. This keeps
one request event mapped to one OpenCode session.

When a human opens an issue without `OpenCode`, the App adds the label, posts a
reminder, and stops processing that original delivery. The resulting exact-label
event starts the normal App-dispatched flow.

An optional issue-title suffix in the exact form `branch: <existing-branch>`
selects the checkout and pull-request base. The App removes that suffix from the
OpenCode request and validates the branch before dispatching the thin workflow
wrapper.
Invalid or missing branches receive an issue comment and do not start the build.
Without the directive, the repository default branch is used.

See the dedicated [Oh My Github App documentation](oh-my-github-app.md) for
App ownership, installation scope, permissions, events, and webhook details.

An issue labeled `omo` additionally installs and configures the OpenCode Ultimate
edition of `oh-my-openagent` with Bun before the OpenCode server starts. The
installer runs non-interactively with provider authentication skipped; `/omo` is
not a command and does not trigger a run by itself. An `omo`-labeled OpenCode run
uses OMO's native `goal` command and prepends `ulw` to the objective. The Codex
Light `ulw-loop` component is not recreated or registered for OpenCode.

## What the job does

1. Checks out the repository with persisted `GITHUB_TOKEN` credentials.
2. Copies `agents.template.md` to `$PROJECT_DIR/Agents.md` so the worker receives
   issue-update, screenshot, and completion-report requirements.
3. Starts an ephemeral AgentsWeb SSH tunnel.
4. Starts the OpenCode web UI and publishes it through a temporary public
   trycloudflare.com tunnel.
5. Creates an `opencode/<run-id>` branch from the relevant base branch.
6. Starts `opencode run --attach` against the same OpenCode installation and
   server-backed session store, then posts a direct URL to that live session.
7. Verifies SSH connectivity.
8. Replaces the access comment with aggregate OpenCode progress statistics and
   refreshes it about every 10 seconds while the run is active. The report also
   counts active child sessions from `/session/status` and all descendant
   subagent sessions from their `parentID` lineage. It also reports inferred
   human-readable elapsed time, aggregate token count and tokens-per-second speed,
   plus inferred image-context model calls by following image MIME attachments
   through each session transcript.
   Message text, reasoning, prompts, and tool details are
   never rendered in the live comment; full logs are published only in the
   completion release.
9. Selects a dedicated web or Android composite verifier. Web issues run a
   second browser-verification prompt, start the app, and expose it through a
   separate temporary trycloudflare.com tunnel. Issues with the exact `Android`
   label instead boot an API 35 Google APIs x86_64 emulator, run the Android
   verification prompt in the same OpenCode session, then independently run
   tests and `assembleRelease`, sign/install/launch the app, probe a todo-style
   input and persistence flow when present, scan for crashes, and capture a
   live-emulator screenshot. Deterministic checks, rather than the attached
   OpenCode CLI, are the success authority.
10. Verifies web apps through the public tunnel. If verification fails, sends a
   remediation prompt to the same OpenCode session and retries up to three
   times. Detects both uncommitted generated files and commits already created
   by OpenCode, then pushes the branch and creates the pull request in YAML.
11. Gives the verified public URL back to the worker, requests committed final
    browser screenshots, and appends immutable screenshot URLs with the game,
    commit, and PR links to the oldest triggering-issue comment containing the
    `🟡 **OpenCode progress (live)**` marker. If screenshots are missing, it
    sends up to two follow-up prompts to the same OpenCode session before
    continuing delivery with a warning.
12. Creates a draft, uniquely tagged GitHub release containing the final
    OpenCode response JSON and safe runner logs. Android releases also contain
    the signed APK, fresh screenshot, and `verification.json`. Every uploaded
    asset is downloaded and checksum-compared before publication; an incomplete
    draft is deleted.
13. Successful runs close SSH and finish immediately. A failed first Android
    emulator attempt is retried with a fresh AVD; a failed second attempt holds
    that emulator and SSH session for five hours. Other failures use the same
    failure-only SSH hold.

An issue with the exact `ssh` label is a debugging-only mode: it starts the
temporary AgentsWeb SSH session, posts the connection command, skips OpenCode,
verification, release delivery, and reporting, then keeps the runner alive for
five hours. Reuse one temporary `known_hosts` file for every SSH/scp command in
that session and delete it after the session ends.

Validation is controlled by the repository variable `VALIDATION_ENABLED`. It
defaults to `true`. When set to `off` (or any value other than `true`), the
workflow stops after the initial OpenCode prompt and temporary OpenCode Web
trycloudflare exposure; app verification/remediation, completion and screenshot
prompts, Git delivery, OmGithub publication, release/report generation, and the
complete label are skipped. The temporary access session still sleeps for five
hours before cleanup only in explicit `ssh` mode; an otherwise successful
validation-disabled run cleans up immediately.

After PR creation, OmGithub publishing is opt-in. Set the repository variable
`OMGHITHUB_PUBLISH_ENABLED` to `true` to ZIP `$PROJECT_DIR/dist`, publish it through
the token-protected API using GitHub's automatically generated repository token,
verify the permanent wildcard URL, and include the permanent game and install
links in the final issue comment. The variable defaults to `false`; if
publishing is enabled but fails, the workflow continues and reports that
publication was unsuccessful. See [OmGithub publishing](omgithub.md).

The comment URL opens `/<encoded-worktree>/session/<session-id>` rather than
the web home page. This matters because the web home page stores its project
selection in the browser, while the runner's project exists only on the
temporary GitHub Actions filesystem.

## Local tracker test

On macOS, run `./scripts/test-opencode-progress-tracker.sh`. It starts a local
mock OpenCode HTTP server with nested, active, and completed child sessions,
including user and tool image attachments, then asserts the three derived
progress counters.

The workflow uses the built-in OpenCode model path and does not require an
`OPENCODE_API_KEY` secret. To authenticate an ephemeral worker with the Mac's
OpenAI OAuth login, save the complete local OpenCode `auth.json` as the
`OPENCODE_AUTH_JSON` repository secret; the workflow passes it through
OpenCode's `OPENCODE_AUTH_CONTENT` environment variable. Branch creation and
pushing are handled by the workflow rather than OpenCode's GitHub integration.
Pull-request creation is requested from the Oh My Github App after it verifies
the workflow run and exact generated branch SHA; the repository token remains
a fallback while the App endpoint is unavailable.

## Findings: tracking the GitHub run in Web UI

The previous GitHub integration installed the OpenCode CLI and ran:

```sh
opencode github run
```

The workflow now sends the comment text directly to `opencode run --attach`.

For the installed `opencode-goal-plugin`, invoke a goal from the non-interactive
CLI with `opencode run --command goal "<objective>"`; passing `/goal <objective>`
as the message sends literal text instead of invoking the custom command. To
send a follow-up to the same attached session, use `opencode run --attach
<server-url> --session <session-id> "<message>"`. In this workflow, the
issue text is passed directly as the objective before it is passed to the custom
command, and later human messages steer the running goal instead of
pausing it.

Before starting OpenCode, the workflow checks out `agents-dev/skills` into
`$PROJECT_DIR/.agents`. OpenCode discovers project skills from
`$PROJECT_DIR/.agents/skills/**/SKILL.md`.
The workflow excludes this nested skills checkout through `.git/info/exclude`
so it cannot be included in the generated app commit.
The workflow verifies the discovered skill list through OpenCode's `/skill`
endpoint and synchronizes `model/<provider>/<name>` and `skill/<name>` labels
in the repository.
This keeps the regular OpenCode session while making branch and PR behavior
explicit and reviewable in YAML.
Model labels are refreshed from the live OpenCode catalog on each run and are
limited to models with zero input, output, and cache-read cost, plus the
explicitly allowed `opencode/gpt-5.6-luna` and `openai/gpt-5.6-luna` models.
Use `model/openai/gpt-5.6-luna` when the OpenAI provider is required. Default GitHub labels are removed, and
the triggering issue is marked `in progress`,
`complete`, or `failed` as the job advances.
For difficult game requests, the `game-issue-e2e` skill selects the synchronized
`model/opencode/muse-spark-1.2-contributor-free` label; if that label is
unavailable, the skill records that it used the workflow default instead.

The workflow reads the repository variable `PROJECT_DIR` as a repository-relative
project home. It defaults to `./`, while this repository sets it to `./project/`.
Absolute paths and parent-directory traversal are rejected. OpenCode Web and all
OpenCode runs use the resolved directory, and skill checkout, Git delivery,
publishing, and screenshot links use the same project home. OpenCode's server
also loads project instances per request using the `x-opencode-directory` header.
A tunneled browser request does not know the runner's `$GITHUB_WORKSPACE`, so
the UI can appear empty even while `opencode github run` is actively working.

The reliable architecture is:

```text
opencode github run
        |
        v
shared OpenCode session/database
        ^
        | x-opencode-directory: $PROJECT_DIR
        |
local header-injecting proxy
        ^
        |
trycloudflare tunnel -> browser Web UI
```

The workflow tunnels a minimal local nginx reverse proxy that injects
`x-opencode-directory: $PROJECT_DIR` before forwarding requests to
OpenCode Web, including WebSocket upgrade headers. The access comment points
to the encoded worktree/session route, so the browser opens the live run
directly. A loaded Web UI or healthy tunnel alone does not prove session
tracking; acceptance requires a screenshot while the run is active.

## Runner selection

The reusable workflow always uses GitHub's `ubuntu-latest` runner. Runner
selection labels are ignored; this keeps web and Android verification on one
consistent KVM-capable runner image.

The centralized runtime checkout follows the triggering branch
(`github.ref_name`) rather than hard-coding `main`. A title suffix of
`branch: <existing-branch>` therefore keeps workflow scripts, prompts, and app
source on the same branch under test; the branch must exist in the repository
before the issue is opened.

## Repository settings

- Existing App installations must approve `Pull requests: write` for App-owned
  PR delivery. Allowing Actions to create pull requests remains a fallback.
- For runner-side SSH access and verification, configure the
  `AGENTSWEB_SSH_PUBLIC_KEY` Actions secret with the public key matching the Mac
  private key described in [access.md](access.md). Without it, the workflow
  skips SSH setup and verification but still exposes the OpenCode Web session.
