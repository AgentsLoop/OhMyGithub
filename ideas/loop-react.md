# ReAct `/loop` improvements

Use a focused ReAct cycle for every five-hour `/loop` iteration:

```text
observe → plan → act → critique → verify → publish → repeat
```

## Critics-to-goal pipeline

Each iteration can make the next objective explicit instead of relying only on
conversation context:

```text
current app
   ↓
parallel critics
   ↓
planner synthesizes findings
   ↓
project/goal.md is replaced with the next objective
   ↓
opencode run --command goal "$(cat project/goal.md)"
   ↓
publish + repeat
```

Keep `original-goal.md` immutable. The critics inspect the current app and
write evidence-backed findings; the planner reads those findings and previous
iteration results, then writes exactly one actionable objective with acceptance
criteria to `project/goal.md`. The root OpenCode session executes that generated
goal, publishes the result, and starts the next critic pass.

## Focused roles

- **Builder:** implement one improvement from the current iteration goal.
- **Critic:** independently inspect the current browser-visible app and identify the single biggest remaining gap.
- **Verifier:** test the exact behavior changed by the builder, including the real browser result.

Feed the critic’s actual output into the next planner or builder prompt. Do not
repeat generic instructions without carrying forward the concrete finding.

## Iteration state

Keep the original user goal immutable. Let the current iteration objective
evolve from critic evidence, while recording:

- iteration number;
- critic finding and evidence;
- selected next objective;
- changed files and commit;
- tests and screenshots;
- public URL and publication status.

## Publication and runtime checks

After each completed iteration:

1. Re-check the public URL because an app restart can make the initial URL stale.
2. Run the relevant tests and browser verification.
3. Capture or update screenshots.
4. Commit and push to the existing branch/PR.
5. Publish a compact issue summary containing the commit, screenshots, tests,
   critic finding, and next objective.
6. Continue the same OpenCode session until the five-hour deadline.

## Stop conditions

Stop the loop early when there are repeated failures, no measurable progress,
an unavailable public runtime, unchanged output across iterations, or a genuine
completion of the original goal.

## Suggested generated goal

The planner can write the next objective to `project/goal.md` and pass it to
the root session with:

```bash
opencode run --command goal "$(cat project/goal.md)"
```

The planner must read the immutable original goal, previous iteration results,
and current critic evidence before writing the next goal.
