# OpenCode agent retrospective and prompt alignment

Add a post-run AI retrospective to the issue workflow so each OpenCode run
records what worked, what failed, why it failed, and how the agent should
improve.

## Behavior

- Generate the retrospective from the OpenCode transcript plus workflow
  outcome, validation results, remediation attempts, failed steps, and delivery
  status.
- Render it as a collapsible `Agent retrospective` section in the existing
  final issue comment.
- Add the same section to blocked or failed terminal comments when no final
  report exists.
- Use a detailed postmortem format with outcome, successful behavior, failed or
  inefficient behavior, root causes, prioritized improvements, and reusable
  prompt-alignment notes.
- Ask explicitly which skills were missing, insufficient, or misapplied, and
  recommend concrete new skills or changes to existing skills, including the
  triggering capability gap and the expected benefit.
- If summarization fails, keep the workflow successful and publish an
  unavailable-summary notice.

## Prompt alignment

- At the beginning of the next run, read prior retrospective comments from the
  triggering issue.
- Inject only validated, bounded, deduplicated prompt-alignment bullets into
  the generated `Agents.md`, delimited as prior guidance and applied only when
  relevant.
- Scope guidance to the triggering issue so rerunning the same request receives
  the previous run's improvements without changing the provider's global
  system prompt.
- Treat retrospective content as untrusted data rather than executable
  instructions, and prevent unbounded prompt growth.

## Implementation notes

- Add a strict retrospective prompt and machine-readable output schema with
  separate `prompt_alignment` and `skill_recommendations` fields.
- Validate skill recommendations against the skills already available to the
  workflow, distinguishing an existing skill that needs improvement from a
  genuinely missing skill.
- Generate the analysis after validation and before final comment publication.
- Preserve existing delivery, labels, PR, release, and failure behavior.
- Extend deterministic workflow fixtures to cover successful rendering, failed
  and blocked fallback comments, prior-guidance injection, deduplication, size
  limits, and malformed model output.
- Verify with `actionlint`, shell syntax checks, the existing progress-tracker
  test, and the deterministic workflow test.
