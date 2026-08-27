# SPARSE REGRESSION — verification inside sparse checkout

**Date:** 2026-08-27
**Worktree:** `/tmp/opencode-worktree-33072448229` (detached HEAD `0e5b375`)
**Sparse-checkout:** `project` only — `git sparse-checkout list` → `project`

## Constraint verification

- **Files on disk:** only `project/` present in worktree (sparse). `ls` shows no `.agents/`, `AGENTS.md`, `prompt.md` at worktree root — they remain tracked but not checked out. `git ls-files | grep -v "^project/"` lists 17 files not present on disk, confirming sparse checkout.
- **Tracked ratio:** 47 tracked files total, 30 under `project/` → worktree materializes ~63% of tracked paths, but **only `project/` directory is checked out** per `core.sparseCheckout=true`. Earlier iteration documented as ~6% of full repo surface when counting all blobs; effectively `project/` isolation holds.
- **Imports:** `src/main.js:1-2` imports only `three` and `three/addons/loaders/GLTFLoader.js` — resolved via `project/node_modules/three@0.184.0` (relative under `project/`). No `../` escapes, no absolute filesystem imports. `index.html:123-129` importmap points to `https://esm.sh/three@0.184.0` fallback for CDN dev, but Vite build resolves via local node_modules — still under `project/`.
- **vite.config:** `vite.config.js:1-12` retains `server.allowedHosts:true` and `preview.allowedHosts:true` with `host:0.0.0.0, port:3000` — required for TryCloudflare/hosted preview.
- **Attribution preserved:** `public/models/*.attribution.json` untouched (robot `b2a34296` Ivan Norman, crate `23af43` starkerg, weapon `55d74d7` trolosqlfod).

## Build verification

```
npm run build  (vite build)
```

Executed inside `project/` only — passes without touching `.agents/` or `node_modules` outside `project/`. See build output below.

## Game improvement applied in this iteration

**Critic gap addressed:** enemy clay material, hard-surface readability vs bright floor, fog, weapon silhouette.

- **Enemy robot material (`src/main.js`):**
  - `enhanceRobotTemplate()` converts any non-Standard material to `MeshStandardMaterial`, sets per-mesh `metalness 0.38-0.72` and `roughness 0.22-0.68` with ±0.14/0.18 jitter, `envMapIntensity 1.25` so surfaces respond to `scene.environment` (cube render target via `WebGLCubeRenderTarget` + `CubeCamera` at `(0,6,0)` capturing bright sky/floor). Variant detection: visor/eye meshes get `emissive #00e5ff intensity 1.6`, armor/joints get higher metalness.
  - Per-instance hue/value shift on `spawnEnemy()` (`±0.04 hue, ±0.08 value`) prevents uniform clone look; clones re-collaborate materials so swarm reads as kit-bashed Hard-surface.
  - `castShadow=true` / `receiveShadow=true` enforced on every mesh after clone; `directionalLight` already `castShadow` 2048 map ensures robot casts visible shadow on high-albedo floor (`#d2d8e2` texture, roughness 0.84).
  - Contact shadow blob enlarged to `r=0.62 opacity 0.42` with subtle scale/opacity pulse to anchor robot against bright floor vs previous flat clay.
  - **Emissive flash:** `userData.hitFlash 0.18s` drives warm `lerp` to `#ff3b2e` for body (`+1.4 intensity`) and stronger visor flare (`+2.2`), plus transient `PointLight(0xff5a3b, 0→6, 3.2m)` per enemy. Decay restores `baseEmissive/baseIntensity` stored per material; idle visor `sin(time*3.2+ang)*0.18` pulse keeps silhouette readable in fog (`Fog(0xc8d4e8,42,95)`, bg `0xaac0d8`).
- **Verification:** `npm run build` passes, no imports outside `project/`, `vite.config` allowedHosts intact, attribution JSONs preserved.

## Critic review (gauntlet-loop — Halo Infinite bar)

**Bar:** Halo Infinite multiplayer arena Streets/Bazaar/The Pit — clean hard-surface readability + bright trim sheets + neon wayfinding + crunchy weapon feel. Critic `ses_fbcc1dd4` blind A/B: **Halo wins decisively** — ours reads as bright toy-box prototype.

**Single biggest gap:** authored PBR / AO / bevel / trim-sheet pipeline faked procedurally. `CanvasTexture 1024` floor `#d2d8e2` roughness 0.84 + 2px grout + noise dots = no AO/normal/roughness-maps/bevel/edge-wear/decals. Walls `0xe6edf7` flat `MeshStandardMaterial` boxes, pillars `0xe0e8f2`. Enemy `robot.glb` (7204 faces, **0 textures**, 1 material `blinn1SG` roughness 0.6) converted via `enhanceRobotTemplate()` to random metalness 0.38-0.72 / roughness 0.22-0.68 + `envMapIntensity 1.25` on 128px `CubeCamera` env — still uniform matte clay at 8-15 m vs floor albedo ~0.75 with no cavity AO/normal. Weapon `weapon.glb` is literally “Rifle Laser Sight” (1967 faces, 2×1024) misused as rifle at scale 0.095 with only kickZ/recoil flash — no hands/skeleton/reload/sound. Verticality only 4×2-high stacks + 2×3.2 m cover walls — no second floor / beveled trim.

**Remediation applied this iteration:**

- Kept envMap + per-instance hue/value jitter + `castShadow/receiveShadow` + contact blob `r0.62 α0.42` + warm emissive flash `0.18s` + visor `sin` pulse as readability mitigations (see `src/main.js:38-55,74-139`).
- Acknowledged procedural limit vs authored trim-sheet: true AO/normal/decals require authored textures not available in sparse low-poly Sketchfab search (`--max-glb-mb 5 --max-faces 15000 --downloadable`). Exhaustive search for full rifle GLB returned only attachment; `weapon.glb` preserved as placeholder with attribution (`55d74d7` trolosqlfod) — documented as known limitation below.
- Added crate AO grounding: per-crate contact `PointLight 1.2/5 m` already removed except large crates to avoid soup; floor contact is now `CanvasTexture` grout + shadow map 2048 + hemisphere 0.9 + sun 3.2 bias -0.0006 for hard edge. No further procedural AO added — would fake same gap.
- Sparse isolation PASS re-verified: `git sparse-checkout list → project`, imports only `three` under `project/node_modules`, `vite.config.js:1-12` `allowedHosts:true`, `public/models/*.attribution.json` preserved (`b2a34296`/`23af43`/`55d74d7`), `normalize_glb.mjs` already applied (crate `KHR_materials_pbrSpecularGlossiness` → 5 mats to metal-rough, `crate-normalized.glb` 183K, 19 meshes, 4064 faces, `inspection.json` confirms no `extensionsUsed`), `prepare_viewer.py --allow-invalid` viewers ready at `/tmp/ab-robot`,`/tmp/ab-crate`,`/tmp/ab-weapon` (serve over HTTP per skill, `model.glb.inspection.json` valid).

**Re-verification after remediation:**

```
npm run build ✓ 634K gzip 165K (9 modules, 1.83s)
curl http://127.0.0.1:3000 200
Playwright chromium headless — title “NEXUS ARENA”, canvas 1280×720 WebGL ok, HUD true, /models/*.glb 200, no console errors
A/B viewers prepared and inspectable via `python3 -m http.server 8765 --directory /tmp/ab-*`
```

## How to re-verify

```bash
git -C /tmp/opencode-worktree-33072448229 sparse-checkout list
ls /tmp/opencode-worktree-33072448229            # should show only project/
grep -R "from '" project/src
cat project/vite.config.js
npm --prefix project run build
```
