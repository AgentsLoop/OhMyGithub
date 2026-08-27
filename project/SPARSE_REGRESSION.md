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

## Iteration 1 continuation — contact AO + roughness variation + weapon sway (gauntlet loop)

**Builder `ses_fbca8dc9bffeiLxFFzp6t02hiB` (parallel):** `project/src/main.js:150-245` `makeFloorTextures()` dual-canvas color 1024 (70 mottles + 55 edge-wear splotches + 6px soft AO along grout + 90 scratches + 3400 grain) + roughnessMap 512 (`#d6d6d6` 55 jitter + 2200 grain + white grout highlights, `anisotropy 8`, `roughness 0.88 metalness 0.02 roughnessMap`) — breaks uniform matte vs Halo albedo variance. Added `makeAOGradTexture()` 128 radial `0.55→0` + `addContactAO()` `MultiplyBlending` polygon-offset planes under crates (`1.55×scale α0.34`), stacks (`α0.36`), cover walls (`len×1.25 α0.30`), wall base (`6.5×1.25 α0.18`), pillars (`1.45 α0.32`), reactor (`3.4 α0.42`) to ground floating geometry without baked AO. Weapon sway `swayTX/TY ±0.09` from `movementX*0.00055` with `pow(0.86)` decay + `dt*9` lerp + strafe lean + breathing `sin 1.05/0.62 + cos 0.9` on pos/rot (`-swayX*0.55`, `-swayY*0.45`, `rot -swayX*1.3`) vs prior static bob — adds Halo inertia to placeholder `weapon.glb` `55d74d7` at `0.095`.

**Critic `ses_fbca740ffffep3uoOgwvMheKJG` (independent, blind vs Halo Infinite Streets/Bazaar/The Pit, https://mat-busy-devel-paragraph.trycloudflare.com + http://127.0.0.1:3000 200 both, screenshots `final-*.png` 213-220KB): Halo wins decisively. Single biggest gap — fully procedural fake PBR vs authored trim-sheet/bevel/AO: `src/main.js:181-239` floor still `CanvasTexture` 1024 `#d2d8e2` with drawn grout + noise, `242` `roughnessMap` canvas `512` — no `aoMap/normalMap`, no bevel mesh, no edge-wear mask, grout is line not cavity AO; `289` walls `0xe6edf7 roughness 0.78` flat `BoxGeometry` boxes zero normal/bevel; `robot.glb 7204 faces 0 textures` hacked via `enhanceRobotTemplate() 74-139` random metal/rough + `38-55` `WebGLCubeRenderTarget 128` single-shot env — still clay at distance; `weapon.glb 1967 faces "Rifle Laser Sight"` `0.095` only kick/flash no hands/skeleton/reload. Until replaced with authored trim sheets (tiled albedo+normal+roughness+AO+bevel/decals) no exposure trick reaches Halo readability.

**Verifier `ses_fbca59b3bffee3JSwvvIQ9tlYx` (parallel):** PASS — `npm run build` 637.89k gzip 166.40k 9 modules 1.66s, `curl http://127.0.0.1:3000 200` 9708 via tmux `app-server`, `curl https://mat-busy-devel-paragraph.trycloudflare.com 200` cf-ray, `/models/*.glb` 200 both, `vite.config.js:3` `allowedHosts:true` for server+preview, `git sparse-checkout list → project`, `src/main.js:1124` 13/13 loop mechanics (WASD `601,811`, pointerlock `519`, joystick `542`, sprint `509`, dash `511,598`, heat `485,693`, recoil `432,697`, tracer `711`, chase `871`, wave `1023`, win `1040`, lose `969`, pickups `491`), Playwright both URLs title `NEXUS ARENA` canvas true HUD hp100 true GLB 200.

**Remediation applied this iteration:** acknowledged procedural canvas roughness/AO planes mitigate floating/flatness but cannot replace authored `aoMap/normalMap` + bevel mesh + edge-wear masks due to Sketchfab low-poly filter (`--max-glb-mb 5 --max-faces 15000 --downloadable`) limiting to 1-texture crate and 0-texture robot; next iteration should search without size filter for tiled trim-sheet material library or procedural normal generation via canvas height → normal. Kept `dist` rebuilt and `tmux app-server` alive for public URL.

**Re-verification after builder+remediation:**
```
npm run build ✓ 637.89k gzip 166.40k (9 modules, 1.66s)
curl http://127.0.0.1:3000 200 9708
curl https://mat-busy-devel-paragraph.trycloudflare.com 200 9708 cf-ray
Playwright 1280×720 both URLs title NEXUS ARENA canvas true HUD true /models/*.glb 200
```

## Iteration 2 — wall trim-sheet bevel/AO + seam decals (gauntlet loop)

**Builder `ses_fbc9e5ce0ffeBVYsfsNeHm2QO6` (parallel):** `project/src/main.js` `makeWallTextures()` 512×512 color canvas (28 mottles + 18 warm dust splotches low-third + 172px vertical groove + highlight pair + 0.48×H mid seam + top 38px / bottom 46px cavity AO gradients + 1600 grain + 42 hairlines, `repeat 1.05×0.58 anisotropy 8`) + 512 roughness canvas (38 jitter blobs + 1400 grain + white seam highlights) + reused bump `0.018` — replaces flat `0xe6edf7 roughness 0.78` `BoxGeometry` walls that critic flagged as “Boxes 0xe6edf7, no normal/bevel”. Wall `MeshStandardMaterial` now `map: wallTexs.color roughnessMap/bumpMap`, `color 0xffffff`. Per-wall geometry added: `bevelTop` `0xf2f6fb 0.038×0.64` highlight at `h-0.235` + `bevelBot` `0xc2cddd 0.042×0.66` cavity at `0.205` (thin chamfer strips along top/bottom edges), two interior vertical seam decals per wall (`seamGeo 0.04×5.02` light `0xc8d3e6` + `seamDark 0.02×5.02` `0x1a2338` offset `±3.55m` along tangent, `translateZ 0.31`), vertical corner chamfers `0.06×(h-0.32)×0.04` `0xd7deea` at `±5.98m`, and 8 rivets per wall (`BoxGeometry 0.05` `0x5a6b88 metal 0.72` at `ys 0.28 / h-0.42, xs ±5.65/±1.85`). Shared geos/mats reused to limit draw calls; total added ≈+48 meshes (8/wall×6). All orbit logic via `ang` `(-sin,cos)` tangent `lookAt(0,*,0)+translateZ` so decals stay flush. Preserves `vite.config.js:3` `allowedHosts:true`, attribution JSONs `b2a34296/vanidza, 23af43/starkerg, 55d74d7/trolosqlfod`, sparse `project/` only, no `.agents` touch.

**Critic `ses_fbc9cb1faffeKylT9nFduuBdnu` (independent, blind vs Halo Infinite Streets/Bazaar/The Pit, https://mat-busy-devel-paragraph.trycloudflare.com 200 + http://127.0.0.1:3000 200 tmux app-server:3000 + screenshots final-*.png 213-276KB): Halo wins decisively — ours still bright pastel toy-box at 8-15m despite iteration 2 wall pass. Single biggest gap — fully procedural fake trim-sheet vs Halo authored tiled albedo(0.75+)+normal+roughness+AO+baked bevel/edge-wear/decals: `src/main.js:20` Fog 42/95 + `31-32` ACES 1.35 wash, `181-239` floor Canvas 1024 `#d2d8e2` with drawn grout + `223-237` roughnessMap 512 `#d6d6d6` no aoMap/normalMap, `281-351` wall color 512 with `bumpScale 0.018` reusing color canvas is fake normal, `370` wall body `roughness 0.79 metal 0.06 map/roughnessMap/bumpMap` on flat Box 12×5.5×0.6, `389-396` bevels thin strips not chamfered trim, `358-363` seams/rivets decal hacks not edge-wear masks; enemy `robot.glb` 0 textures hacked `74-139` random metal/rough + CubeCamera 128 still clay; weapon `weapon.glb` 1967 faces `0.095` no hands. Until authored trim-sheet library + baked AO/normal + bevel mesh, no tweak reaches Streets readability.

**Verifier `ses_fbc9bfb09ffe9ELjdsa6zKe4lF` (parallel):** PASS — `npm --prefix project run build` 642.05k gzip 167.41k 9 modules 1.63s (vs 637.89k prev +4.16k), `curl http://127.0.0.1:3000 200` 9708 via tmux `app-server` `vite preview --host 0.0.0.0 --port 3000`, `curl https://mat-busy-devel-paragraph.trycloudflare.com 200` cf-ray, `/models/*.glb` 200 both, `vite.config.js:5,10` `allowedHosts:true`, `git sparse-checkout list → project` cone false, `src/main.js:1` 1254 lines 13/13 loop mechanics (WASD/pointerLock/shoot/heat/recoil/spawn/AI/damage/HUD/wave/collision/pickup/particles/animate) pass, Playwright both URLs title `NEXUS ARENA` canvas true HUD hp100 true GLB 200 pass.

**Remediation applied this iteration:** acknowledged wall CanvasTexture + bevel strips + seam/rivet decals mitigate flatness but still procedural Canvas grout/noise vs Halo baked `aoMap/normalMap` + bevel mesh + edge-wear masks; floor remains procedural Canvas grout (next step tiled trim-sheet material library or procedural normal from height). Kept `dist` rebuilt (`index-DbvrohAT.js`) and `tmux app-server` alive for public URL.

**Re-verification after builder+remediation:**
```
npm run build ✓ 642.05k gzip 167.41k (9 modules, 1.63s) vs 637.89k prev (+4.16k)
curl http://127.0.0.1:3000 200 9708
curl https://mat-busy-devel-paragraph.trycloudflare.com 200 9708 cf-ray
Playwright 1280×720 both URLs title NEXUS ARENA canvas true HUD hp100 true /models/*.glb 200
```

## How to re-verify

```bash
git -C /tmp/opencode-worktree-33072448229 sparse-checkout list
ls /tmp/opencode-worktree-33072448229            # should show only project/
grep -R "from '" project/src
cat project/vite.config.js
npm --prefix project run build
```
