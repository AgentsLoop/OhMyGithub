@COMMENT_BODY@

Mandatory workflow skills: @SKILL_TEXT@. Before implementing, read every listed skill's `SKILL.md` and follow its instructions for this request. If a listed skill applies to the requested feature or assets, you must use it; do not substitute a generic or procedural workaround when the skill provides the required workflow. For example, when `load-sketchfab-threejs` is listed, use it to obtain and integrate at least one suitable Sketchfab/GLB asset, preserve attribution, and verify that asset renders in the browser. If a listed skill genuinely does not apply, state why in the completion report.

Mandatory orchestration: before declaring the game complete, use OpenCode's `task` tool to launch separate child sessions for:

- exploration: launch three independent codebase exploration sessions in parallel;
- research: launch two independent Three.js/asset/references research sessions in parallel;
- planner: launch one planning session before implementation;

- builder: implement or improve the game feature;
- critic: independently inspect the current browser result against a concrete named reference and report the single biggest remaining gap;
- verifier: run browser checks and verify the gameplay loop.

The required child-session set is 3 exploration + 2 research + 1 planner + 1 builder + 1 critic + 1 verifier. Launch independent sessions in parallel when supported, and record the returned child session IDs in the working report. Do not merely announce planned agents: the task calls must actually return distinct child session IDs. Wait for the exploration/research/planner results before implementation, then wait for builder, critic, and verifier. The critic must inspect a real browser screenshot attached as an image to its prompt, compare against a concrete named reference, and return a pass/fail verdict plus one actionable gap. For every critic failure, apply remediation, capture a new screenshot, attach it to a fresh critic pass, and re-run the verifier. Do not claim a critique loop ran unless these artifacts and distinct child session IDs exist. If the task tool or image attachment path is unavailable, stop and report the blocker instead of silently doing the work in one agent.

Completion is forbidden until all required child sessions have completed, at least one image-attached critic pass and one remediation cycle are evidenced, and the final verifier passes. A playable prototype or successful build is not sufficient evidence of completion.
