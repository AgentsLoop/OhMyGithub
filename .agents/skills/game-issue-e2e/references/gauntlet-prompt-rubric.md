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
  record their URLs and purpose. For other work, collect primary docs,
  representative data, comparable products, or executable acceptance fixtures.
- Require vision and direct inspection of the actual artifact whenever visual
  judgment matters. Compare renders, captures, documents, diagrams, scenes,
  or interfaces side by side or with blind A/B review whenever practical.
- For every completed attempt at character animation, asset creation,
  environment work, or another visually important piece, require a separate
  critic who writes no code and acts as a brutal AAA art director. The critic
  must take fresh screenshots from several viewpoints and zoom levels, inspect
  the actual running artifact, and score design and aesthetics from 0 to 10:
  above 8.5 is AAA quality, 7 is good indie quality, and 5 is programmer art.
  Define a pass as a total score of at least 28.5 across the agreed visual
  criteria with zero blocking errors. Below the pass threshold, the critic
  must return a ranked issue list to the builder and the builder must retry.
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
- Tell the spawned lead to act as the orchestrator for continuous multi-day
  work and as the CTO of the game studio or project business. Make it own the
  product and technical vision, roadmap, team delegation, quality bar, risks,
  decisions, and delivery. Make it delegate and integrate the pieces,
  research, implement, verify, and iterate ambitiously toward the complete
  requested outcome. Treat prototypes, demos, and smoke tests as intermediate
  milestones, never as completion; continue until the acceptance bar is met or
  an explicit blocker requires the user.
- Continue the build/verify/improve loop until the acceptance bar is met or
  the run is stopped with explicit evidence. Do not specify an arbitrary round
  count or stop after the first build or smoke test.
- Include only observable product constraints, evidence requirements, and
  recovery behavior. Let the lead choose the tools and implementation.
- Format the issue body as GitHub-flavored Markdown. Use concise headings for
  the title, objective, quality bar, execution, verification, and progress;
  use bullets for requirements and Markdown links for references. Repeat the
  exact issue title as the first heading in the body while keeping it as issue
  metadata, and do not put routing metadata in the body.

## Prompt shape

Use this structure for the issue body:

```markdown
# [Exact issue title]

## Objective

Deliver [project outcome] to production quality for [intended users]. Preserve
[named source, output surface, dimensionality, or domain constraints].

## Quality bar

- Research authoritative references and record selected anchors or acceptance
  fixtures before coding.
- Inspect the real artifact with the relevant tools and compare it with the
  acceptance bar.
- After each visual attempt, use a fresh-context, no-code AAA art-director
  critic to capture multiple viewpoints and zoom levels, score the design and
  aesthetics from 0 to 10, and return a ranked defect list. Treat scores above
  8.5 as AAA quality, 7 as good indie quality, and 5 as programmer art. Pass
  only at 28.5 or higher with zero blocking errors; otherwise send the work
  back to the builder for another attempt.

## Execution

- Act as the CTO of the game studio or project business and the orchestrator
  for continuous multi-day work. Own the product and technical vision,
  roadmap, team, quality, risks, decisions, and delivery. Keep delegating,
  integrating, implementing, verifying, and improving the complete outcome;
  treat prototypes and demos as intermediate milestones.
- Have the lead split the work into judgeable pieces.
- Give each piece a builder and a fresh-context critic or verifier.
- For visual pieces, keep the critic separate from the builder and require the
  critic to write no code. Make the critic inspect fresh screenshots from
  several viewpoints and zoom levels, score the result, and hand back ranked
  issues before the builder retries.
- Work across as many days or sessions as necessary.

## Verification

- Fix the largest remaining gap and repeat until the acceptance bar is met.
- Do not accept a visual piece until its critic records at least 28.5 total
  points across the agreed criteria and zero blocking errors. Below that gate,
  rank the issues, return them to the builder, and repeat the attempt.
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
