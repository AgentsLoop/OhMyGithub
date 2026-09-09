# Standalone issue-triggered OpenCode workflow

## Setup

Install `.github/workflows/opencode.yml` on the repository default branch.
Use the GitHub App as a setup helper for new installations and added repositories,
or install the caller manually. Create the `OpenCode` label during setup.
Pin the preparation and execution workflows to one central commit.

## Access and triggers

Leave repository variable `OPENCODE_ACCESS` unset, or set it to `writers`, to
require write, maintain, or admin access for the issue author. Apply `OpenCode`
after creating the issue and its mode labels.

Set `OPENCODE_ACCESS=everyone` to accept any issue author. Let visitors open an
issue with `/OpenCode` in its title, such as `/OpenCode Build a maze game`.
Use a separate word with the exact spelling. Add the execution label inside
the opened-issue run with `GITHUB_TOKEN`, then continue the same run. Let the
label event handle issues created with `OpenCode` already attached.

Ignore unrelated events. Use a separate concurrency group for skipped events.
Serialize execution requests per repository and issue. Read the access variable
from repository Actions settings; reject unsupported values.

## Preparation

Run `scripts/opencode-prepare.mjs` on the Actions runner. Use its repository
token for GitHub API calls. Check author access, compare the event snapshot
with the current issue, resolve the branch, and record the request in a
GitHub Actions bot comment before starting execution.

Use the issue body as the request, or the title when the body is empty. Remove
the `/OpenCode` marker and trailing `branch: <existing-branch>` directive from
the title used as prompt text. Keep all other request text intact.

Store the originating issue or label event ID, run ID, attempt, snapshot hash,
and checkout SHA in the request comment. Read only records authored by
`github-actions[bot]`. Compare previous run status through the GitHub API.
Reject duplicate completed requests and requests submitted during active work.
Retry failed runs explicitly and keep their frozen checkout SHA. Preserve
these comments to preserve duplicate detection.

Ignore `in progress`, `validating`, `complete`, and `failed` when comparing
request labels. Reject edited request content. Reapply the execution label
to request another run with updated content.

## Execution contract

Pass validated `issue_number`, `request`, `issue_title`, `sender`, and
`labels_json` from preparation. Pass label names as strings. Pass `target_ref`
as the selected result-base branch and `target_sha` as its frozen checkout.
Pass `runtime_ref` as the central workflow commit. Keep model and tunnel
secrets in the execution job.

Load workflow code from the default branch and project code from the selected
commit. Resolve the default branch when no branch suffix exists. Reject invalid
or missing branches before execution.

## Site submissions

Create site issues with the signed-in user's GitHub token and `/OpenCode` in
the title. Request the mode and execution labels in the creation API call.
Let GitHub enforce label permissions and let Actions enforce execution access.
Install the listener before accepting submissions.

## Verification

- Test restricted author access and `everyone` access.
- Test `/OpenCode` issue creation without the execution label.
- Test a labeled issue and skip duplicate opened-event execution.
- Verify preparation calls only repository GitHub APIs.
- Verify request edits, invalid branches, duplicate claims, and failed retries.
- Verify pinned workflow code, frozen checkout, and result delivery.
- Test the installed caller with the setup service unavailable.
