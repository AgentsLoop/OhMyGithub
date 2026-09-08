# Issue-triggered OpenCode workflow

## Objective

Move execution triggering from the GitHub App to `issues.labeled`. Keep the
exact `OpenCode` label as the execution request. Implement the contracts below
before enabling the new trigger; treat this document as a proposal.

## Request and authorization flow

1. Install the issue listener on the repository default branch before accepting
   execution requests. Create App-submitted issues without execution labels.
2. Authenticate the submitting user. Require write, maintain, or admin access
   to the target repository. Move this check from the dispatch handler into
   the App submission path before applying `OpenCode`; do not trust a supplied
   username or the App bot's repository permission as user authorization.
3. Validate the request and optional `branch: <existing-branch>` title suffix.
   Use an App installation token to apply `OpenCode` after validation. Avoid
   using a workflow `GITHUB_TOKEN` for this operation because its label events
   do not start another workflow.
4. Start a preparation job only for the exact `OpenCode` label. Repeat the
   authorization check there before starting the privileged reusable job.
   For direct human requests, preserve the current issue-author permission
   policy. For App-created issues, verify an App approval record tied to the
   authenticated submitter, repository, issue, and exact request snapshot.
5. Store App approval records in App-controlled storage and retrieve them
   through an authenticated interface. Bind each record to the title, body,
   label names, and selected branch. Reject missing or mismatched approval;
   do not accept an editable issue field or comment as approval proof.
6. Validate and freeze the event snapshot in preparation. Pass that snapshot
   to OpenCode. Do not fetch a newer body after validation. Reject an edited
   App request until the App approves its new snapshot.
7. Stop on authorization or validation failure. Publish a clear failure reason
   without starting OpenCode or exposing model and tunnel secrets.

## Trigger fragment

Use this fragment in the caller. Add the preparation and reusable jobs described
below; do not deploy this fragment alone.

```yaml
name: OpenCode issue

on:
  issues:
    types: [labeled]

permissions:
  contents: write
  issues: write

concurrency:
  group: opencode-issue-${{ github.repository }}-${{ github.event.issue.number }}
  cancel-in-progress: false
```

Apply `if: github.event.label.name == 'OpenCode'` to the preparation job. Make
execution depend on successful preparation and an explicit approval output.
Give preparation only the permissions and credentials needed for validation.
Pass model and tunnel secrets only to the execution job. Expect unrelated
label events to create skipped workflow runs, without executing OpenCode.

## Reusable workflow contract

Keep the existing required inputs and supply them from validated preparation
outputs. Do not assume the current reusable workflow retrieves the issue body;
it consumes `inputs.request`.

| Input | Required handling |
| --- | --- |
| `issue_number` | Convert the triggering issue number to a string. |
| `request` | Build the exact request from the validated snapshot; preserve current prompt construction and remove branch metadata. |
| `issue_title` | Pass the validated title used for reporting. |
| `sender` | Pass the authorized human identity; preserve issue-author semantics for direct human requests. |
| `labels_json` | Pass an array of label-name strings; use `toJSON(github.event.issue.labels.*.name)` before validation. |
| `target_ref` | Add a required input for the validated branch name used as the result base. |
| `target_sha` | Add a required input for the commit resolved from that branch during preparation. |

Update checkout to use `target_sha`. Update `TARGET_REF` and result-base handling
to use `target_ref`. Stop deriving the target checkout from `github.ref_name`.
Resolve the default branch when the title has no branch suffix. Reject invalid
or missing branches before execution.

Load workflow code from the default branch for repository-owned workflows.
Record this deliberate change from the current selected-branch workflow
behavior. Use the selected branch only for project checkout and the result
base. Review callers and tests that currently depend on selected-branch
workflow code.

Keep the local reusable path in this repository. Generate installed-repository
wrappers that call the central reusable workflow at an approved commit SHA;
do not assume those repositories contain a local reusable file. Update the
wrapper generator and both call paths together. Preserve caller write
permissions because a reusable workflow cannot elevate its caller's token.

## Execution and retry rules

Use per-issue concurrency to prevent overlapping executions. Do not treat
concurrency as duplicate-request detection or as a complete request queue.
Reject a new request while that issue has an active execution, and define a
persistent request identifier before adding automatic retry behavior.

Use the originating label-event identity for request tracking. Keep a durable
claim for each accepted request so repeated delivery cannot start it twice.
Allow an explicit failed-run retry only after checking the prior execution
state; keep this claim outside the runner workspace. Do not retry completed
requests automatically.

Document removal and reapplication of `OpenCode` as a new request. Revalidate
its snapshot and permissions. Do not promise automatic workflow retries from
GitHub event delivery alone.

## Migration sequence

1. Implement preparation, approval storage, request claims, and the new reusable
   inputs. Update the App submission path and wrapper generator.
2. Test in an isolated repository with App dispatch disabled for that repository.
   Keep only one execution owner per repository.
3. Pause new submissions for each production repository. Drain active runs and
   record outstanding requests. Disable its App dispatch route before enabling
   the issue listener on the default branch.
4. Install and verify the listener and its reusable-workflow reference. Resume
   submissions only after installation succeeds. Recover recorded requests
   through explicit, validated label application.
5. Remove dispatch-specific code and permission checks after all repositories
   migrate. Retain permissions still required for wrapper installation or
   other App operations; audit those operations before reducing permissions.
6. Update `AGENTS.md`, the workflow wiki, and the issue E2E skill to match the
   final trigger and request flow.
7. Roll back by pausing submissions, disabling the listener, draining active
   work, and restoring dispatch ownership before resuming requests.

## Acceptance checks

- Verify authorized App submissions and direct human label requests.
- Reject unauthorized submitters, forged usernames, and label requests that
  bypass App approval for App-created issues.
- Reject App requests edited after approval. Execute only the validated snapshot.
- Verify all required inputs and label-controlled modes with label-name arrays.
- Verify default-branch and explicit-branch checkout, result-base selection,
  missing-branch rejection, and the documented workflow-code revision policy.
- Verify the local reusable call and a newly installed central-workflow wrapper.
- Verify caller permissions, secret isolation, and clear validation failures.
- Verify duplicate delivery, active-run requests, failed-run retry, and relabeling.
- Verify that unrelated labels do not execute OpenCode.
- Verify that migration and rollback cannot activate both execution paths.

## References

- Check [GitHub issue event rules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#issues).
- Check [workflow token trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
- Check [reusable workflow permission limits](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations).
