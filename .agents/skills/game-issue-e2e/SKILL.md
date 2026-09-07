---
name: issue-e2e
description: Start the issue-triggered workflow and return its initial OpenCode session link.
---

# Issue E2E kickoff

Use only for an explicitly requested issue-triggered E2E run. Create the issue
and Action, then stop at the initial Web UI link. Do not claim implementation
completion.

## Write the issue prompt

Read `references/gauntlet-prompt-rubric.md` before rewriting a sparse request.
Use these rules:

- Preserve the requested subject, named product, and intended user experience.
  Preserve named products, source material, workflows, and domain constraints.
  For a recreation or named existing product, target the closest practical
  production-quality result rather than a generic substitute. For new work,
  choose a concrete quality reference and state why it is the right bar.
- Determine the project's real output surfaces and dimensionality. Preserve
  the requested web, desktop, mobile, backend, data, document, visual, or 3D
  behavior. Never silently replace a requested medium with a flatter or less
  capable approximation.
- Require research before implementation. Search for authoritative product
  references, real screenshots or footage when the output is visual, and
  primary documentation or representative data for other projects. Record
  source URLs, selected anchors, and the reason for each in the live progress
  page.
- Require vision and direct artifact inspection wherever visual judgment
  matters. Inspect rendered pages, screenshots, videos, documents, diagrams,
  dashboards, or scenes with the available visual tools; do not accept a text
  description as evidence of visual quality.
- Set production-quality scope. Implement the complete requested project,
  workflows, states, error handling, polish, and acceptance criteria. Do not
  reduce the assignment to a demo, stub, mock, or throwaway proof of concept.
- Assume substantial requests require sustained execution across many days or
  sessions. Preserve resumable state in the live progress page, including
  completed work, evidence, decisions, blockers, current gaps, and the next
  exact action. Resume from that state instead of restarting or stopping after
  the first build or smoke test.
- Require an iterative verification loop: a builder produces the piece, a
  fresh-context critic or verifier inspects the actual artifact, compares it
  with the acceptance bar, identifies the largest remaining gap, and sends it
  back for another improvement. Use the relevant browser, test runner,
  emulator, device, API, document viewer, image tool, or other inspection tool.
  Continue until the bar is met or the run is stopped with explicit evidence;
  do not use a fixed round count.
- Let the lead choose the implementation and divide the work into
  independently judgeable pieces. State observable behavior, quality bars,
  evidence requirements, and recovery behavior instead of prescribing an
  architecture.
- Write the issue body as readable GitHub-flavored Markdown. Use short
  headings such as `## Objective`, `## Quality bar`, `## Execution`,
  `## Verification`, and `## Progress`; use bullets or numbered lists where
  they improve scanning, and use Markdown links for references. Keep the issue
  title plain and keep routing metadata out of the body.
- If text appears before or after the skill invocation, merge it and rewrite
  it in your own words. If the invocation begins the request, preserve the
  request after removing only invocation syntax and routing labels. Keep the
  final prompt concise while retaining the production, persistence,
  verification, and review contract.

Do not execute the full Gauntlet Loop during issue-e2e kickoff. The prompt
should instruct the worker to perform the sustained project work after the
issue starts.


Check `git branch --show-current`. If non-empty and not `main`, verify it and
append ` branch: <current-branch>` to the title. The reusable workflow checks
out `github.ref_name` and bases its OpenCode branch on it, preserving the
debugging worktree. This suffix is routing metadata, not prompt text. On `main`,
omit it.

If the request contains `#main`, use the supplied or current repository on its
`main` branch; remove `#main` from the prompt and do not default to
`AgentsLoop/PlayGround`. Otherwise, use the supplied repository or
`AgentsLoop/PlayGround` when the selected branch is `main`.

if other local skills mentioned verify they exist on https://github.com/agents-dev/skills/ or push them first

## Procedure

1. Check `git status --short` and the current branch; preserve unrelated work.
2. Treat request tags like `#mac` as GitHub labels: strip `#`, create missing
   labels, and attach them with `OpenCode` and `Goal`. Do not create a label for
   `#main`. Verify labels with `gh issue view <number> --json labels`. Comments,
   edits, and other labels are not triggers.
3. Confirm the newest run is matching `workflow_dispatch`, title, and current
   non-`main` branch (or `main`):

   ```sh
   gh run list --repo <owner>/<repo> --workflow opencode.yml --limit 5 \
     --json databaseId,displayTitle,event,status,url,headBranch
   ```

   An `issues` event or wrong branch is routing failure, not validation.
4. Poll only until the initial Web UI URL appears; return issue, run, and session
   links immediately. Do not `gh run watch` to completion or cancel/rerun an
   active run without checking its current step.
