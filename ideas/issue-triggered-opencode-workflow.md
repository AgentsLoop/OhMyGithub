# Run OpenCode once per issue

Install the listener on the default branch. Use `issues.opened` as the only automatic trigger.
Create the issue with `OpenCode` and all mode labels already attached, or include `/OpenCode` in the title.
Use one Actions run containing preparation and execution jobs. Serialize each issue with Actions concurrency.

Leave `OPENCODE_ACCESS` unset or use `writers` to require write, maintain, or admin access for the author.
Set `OPENCODE_ACCESS=everyone` to accept any author.
Read the issue, check access, resolve `branch: <existing-branch>`, and pass the resolved SHA to execution.
Use the App only to install the listener. Run preparation through the GitHub API on the runner.

Start an existing issue with `gh workflow run opencode.yml --repo <owner>/<repo> -f issue_number=<number>`.
Read the current issue and branch on each manual start or retry.
Update installed callers to the current runtime SHA when migrating from the old service-based preparation.

Verify one run for a new issue with mode labels. Verify preparation, execution, and completion.
Test both access modes and reject invalid branches, closed issues, and pull requests.
