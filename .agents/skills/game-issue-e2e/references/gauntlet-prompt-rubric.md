# Prompt-writing rubric

Use this rubric when rewriting a sparse request into an issue prompt. Write
the prompt in imperative English. Preserve the user's subject, desired
outcome, domain, and constraints. Remove invocation syntax and routing labels
from the prompt.

## Required content

The prompt must:

- State the concrete project outcome, intended users, and observable success
  criteria.
- Treat a recreation or named existing product as a fidelity target. Require
  the recognizable visual language, interaction model, workflows, and quality
  of the source. For new work, choose a concrete reference and justify it.
- Preserve the requested output surface and dimensionality. Explicitly require
  the real web, desktop, mobile, backend, data, document, visual, or 3D
  behavior that the request needs. Do not allow a flatter substitute.
- Require research before coding. For visual work, search real screenshots,
  footage, and interface views, select at least six high-signal anchors, and
  download all screenshots or images selected or used as visual anchors into
  the project under a clearly named reference-assets directory. Inspect the
  downloaded files directly and record each source URL only as provenance
  beside the local filename; do not substitute Markdown image links for the
  downloaded assets. For other work, collect primary docs, representative
  data, comparable products, or executable acceptance fixtures.
- Require vision and direct inspection of the actual artifact whenever visual
  judgment matters. Compare renders, captures, documents, diagrams, scenes,
  or interfaces side by side or with blind A/B review whenever practical.
- Set a production-quality bar. Require complete requested workflows, real
  states, error and recovery behavior, polish, accessibility or operability,
  and deployment or delivery evidence where applicable. Do not narrow the
  work to a demo or temporary proof.
- Require a lead to choose the route and divide the project into independently
  judgeable pieces. Do not prescribe the architecture or exact decomposition.
- Require a separate builder and fresh-context critic or verifier for every
  important piece. The verifier must inspect the actual artifact, compare it
  with the bar, identify the largest remaining gap, and send the work back.
- Assume substantial requests require sustained execution across many days or
  sessions. Keep a canonical live progress page with references, decisions,
  completed work, evidence, blockers, current gaps, and the next exact action
  so another agent can resume without losing context.
- Continue the build/verify/improve loop until the acceptance bar is met or
  the run is stopped with explicit evidence. Do not specify an arbitrary round
  count or stop after the first build or smoke test.
- Include only observable product constraints, evidence requirements, and
  recovery behavior. Let the lead choose the tools and implementation.
- Format the issue body as GitHub-flavored Markdown. Use concise headings for
  the title, objective, quality bar, execution, verification, and progress;
  use bullets for requirements and local filenames plus plain source URLs for
  reference provenance. Do not turn reference screenshots into Markdown image
  links, and do not put routing metadata in the body.

## Prompt shape

Use this structure for the issue body:

```markdown
## Objective

Deliver [project outcome] to production quality for [intended users]. Preserve
[named source, output surface, dimensionality, or domain constraints].

## Quality bar

- Research authoritative references, download selected visual anchors into a
  local reference-assets directory, and record their provenance before coding.
- Inspect the real artifact with the relevant tools and compare it with the
  acceptance bar.

## Execution

- Have the lead split the work into judgeable pieces.
- Give each piece a builder and a fresh-context critic or verifier.
- Work across as many days or sessions as necessary.

## Verification

- Fix the largest remaining gap and repeat until the acceptance bar is met.
- Record concrete evidence for behavior, quality, and delivery.

## Progress

Maintain a resumable live progress page with references, evidence, decisions,
blockers, gaps, and next actions.
```

Replace bracketed text with the user's subject and only the necessary project
constraints. Keep the prompt concise, but never omit the production bar,
research, direct inspection, persistence, evidence, or iterative verification
loop. Add vision-specific inspection instructions whenever the artifact is
visual; use the appropriate nonvisual evidence for other projects.

This is prompt guidance only. The issue-e2e skill remains kickoff-only and
does not run the full Gauntlet Loop.
