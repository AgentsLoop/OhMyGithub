# Gauntlet Loop — SHADOW PROTOCOL FPS

Paste-ready prompt (120-180 words) for next iteration. Generated per `gauntlet-loop` skill.

```
Build SHADOW PROTOCOL, a first-person shooter in Three.js that beats Call of Duty: Modern Warfare III (2023) and Black Ops 6 (2024) side-by-side.

The bar is Call of Duty: Modern Warfare III — get real MWIII gameplay footage/screenshots (IW 9.0 engine, PBR, volumetric fog, SSAO, motion blur, mocapped viewmodel with hands) and compare directly, not from description.

Break this into the smallest pieces that can be improved and judged alone — weapon PBR viewmodel, environment PBR textures & geometry density, lighting/volumetrics/post, animation/ragdoll, audio/HUD, enemy AI. For each piece, fan out a builder and a separate critic with fresh context. The critic opens the real MWIII footage, puts our browser screenshot next to it blind with labels stripped, says which is better, and names the single biggest remaining gap. Then it goes back to the builder.

The critic should be a harsh critic. Praise is not useful. If ours does not win, it keeps going.

/loop on each piece until the critic picks ours blind. Do not stop before that.

Keep a live progress page updating as the work evolves so I can watch it.

Fan out subagents and ultracode.
```

I can run this here.

## Bar choice
- **Primary:** Call of Duty: Modern Warfare III (2023) — MWIII is the most recent shipped CoD at time of writing with fetchable YouTube 4K gameplay, screenshots, and documented IW engine features. Direct blind compare is possible via screenshots at 1280x720.
- Alternatives considered: Black Ops 6 (2024), Warzone 2.0. MWIII chosen as hardest fetchable bar with comparable indoor facility map (Grid-7 style).
- Measurable half: 60 FPS locked on canvas, <300ms input-to-shot latency, 0 console errors, Playwright screenshot network 200 for GLB.

## Current iteration status
- Builder ses_fbe7d9f4 — procedural arena + procedural M4A1, PBR, raycast, 12 enemies
- Critic ses_fbe7371b — harsh verdict: flat-shaded primitives / black weapon silhouette = biggest gap
- Verifier ses_fbe7371b — initial pass
- Remediation: brightened scene (0x0d1218→0x141c24, fog 0.012→0.006, exposure 1.15→1.45), PBR CanvasTexture for floor/walls, SG553 GLB (92a2efa3086b4eec8ee93b910ce77aa1, wburton CC Attribution) integrated via GLTFLoader + AnimationMixer, fallback preserved.
- Verifier 2 ses_fbe6677f — re-pass after fix
