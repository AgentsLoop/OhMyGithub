# Prompt-writing rubric

Use this rubric when rewriting a sparse request into an issue prompt. Write
the prompt in imperative English. Preserve the user's named game and desired
experience. Remove invocation syntax and routing labels from the prompt.

## Required content

The prompt must:

- State the concrete recreation target and intended player experience.
- Treat a named game as a fidelity target. Say that the result must closely
  resemble the original game's recognizable camera, composition, environment,
  player objects, effects, interface, and core interactions. Do not weaken the
  target to a generic genre game.
- Identify the required dimensionality. For a 3D source, explicitly require a
  real 3D implementation with perspective, depth, geometry, lighting,
  materials, and spatial interactions. Do not allow a flat or sprite-based
  substitute for a three-dimensional source.
- Require image research before coding. Search for real gameplay screenshots,
  official gameplay footage, and useful interface views. Select at least six
  anchor references spanning gameplay composition, camera, environment,
  player objects, effects, and HUD or menus. Record the URLs and explain why
  each anchor matters in the live progress page.
- Define an inspectable visual bar. Compare the running result directly with
  the selected references using side-by-side or blind A/B review whenever
  practical. Judge silhouette, framing, scale, color, lighting, motion,
  interface placement, and interaction feedback rather than accepting a
  verbal claim of polish.
- Require a lead to choose the route and divide the work into independently
  judgeable pieces. Do not prescribe the architecture or exact decomposition.
- Require a separate builder and fresh-context critic for every important
  piece. The critic must inspect the actual running output, identify the
  largest remaining mismatch, and send the work back for improvement.
- Continue the builder/critic loop until the result closely resembles the
  references or the run is stopped. Do not specify an arbitrary round count.
- Ask the lead to maintain a live progress page containing reference URLs,
  screenshots or captures, current gaps, and the next improvement.
- Include only observable product constraints: controls, core loop, feedback,
  win/lose state, and restart behavior.

## Prompt shape

Use this compact structure:

```text
Recreate [named game or experience] as closely as practical. Preserve the
source game's presentation dimensionality and [observable core loop]. Before
coding, search for real reference images or gameplay footage, select visual
anchors, and record their URLs. Have the lead split the work into judgeable
pieces; give each piece a builder and a fresh-context critic. Compare the
running result against the anchors, fix the largest mismatch, and repeat until
the result closely resembles the original or the run stops. Maintain a live
progress page with references, captures, gaps, and next actions.
```

Replace bracketed text with the user's subject and only the necessary product
constraints. Keep the prompt concise, but never omit the dimensionality,
reference research, evidence, or iterative fidelity loop.

This is prompt guidance only. The issue-e2e skill remains kickoff-only and
does not run the full Gauntlet Loop.
