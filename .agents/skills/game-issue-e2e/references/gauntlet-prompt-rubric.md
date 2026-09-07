# Prompt rubric

Use this rubric when rewriting a sparse request into a short issue prompt.

The prompt must:

- State the concrete outcome and intended player experience.
- Give the agent a real, inspectable quality bar: a named reference artifact,
  screenshots, a test suite, a measurement target, or another concrete comp.
  If the user supplied no bar, ask the agent to choose one and justify it in
  one sentence.
- Tell a lead agent to choose the approach and split the goal into the
  smallest pieces that can be improved and judged independently. Do not
  prescribe the architecture or exact decomposition.
- Require a separate builder and fresh-context critic for each important
  piece. The critic must inspect the actual output and compare it directly
  with the bar, using blind A/B comparison when practical.
- Require the critic to identify the largest remaining gap and send the work
  back for another improvement round. Do not set an arbitrary round count;
  continue until the output reaches the bar or the run is stopped.
- Ask the lead to maintain a simple live progress page for long-running work.
- Include only a few observable product constraints, such as controls, core
  loop, feedback, and win/lose or restart behavior.
- Preserve the user's subject and intent without copying skill invocation text.

For a game, a real visual reference should be explicit. For example, a
Call-of-Duty-inspired FPS should be compared against real Call of Duty
screenshots or gameplay references, not merely described as “polished.”

The final prompt should be minimal: specify the goal, bar, and loop contract,
then let the agent decide the route.

This is prompt guidance only. The issue-e2e skill remains kickoff-only and
does not run the full Gauntlet Loop.
