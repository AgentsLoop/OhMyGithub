# Weapon GLB Slot — Sketchfab Asset

Reserved slot for the primary weapon model. Drop a GLB here and the game auto-loads it (see `src/main.js` → `GLTFLoader.load('public/models/weapon.glb')`).

## Recommended Sketchfab queries
- `M4A1 low poly` / `MCX` / `TAQ-56` — military rifle, PBR, < 150k tris
- Filter: **Downloadable**, **CC-BY / CC0**, **low poly**, **PBR**

## How to add
1. Find a downloadable Sketchfab model (see `load-sketchfab-threejs` skill for attribution).
2. Download GLB (gltfpack or original), place as:
   ```
   public/models/weapon.glb
   ```
   Optional secondary (e.g. enemy rifle): `public/models/rifle.glb`
3. The loader in `src/main.js` already handles:
   - `THREE.GLTFLoader` via `three/addons/loaders/GLTFLoader.js`
   - Draco / KTX2 not required — keep GLB self-contained (embed textures).
   - Normalizes scale + centers pivot; preserves attribution in `ATTRIBUTION.md` next to the GLB.
4. If no GLB is present, a procedural rifle (box + cylinder + mag + red dot) is used — zero extra download.

## Normalization checklist (GLB)
- Up axis +Y, forward –Z
- Scale: weapon ~0.6 m long in world units (≈ 0.6 on Z). Loader does not auto-rescale; modeler should export at 1 unit = 1 m.
- Keep materials `MeshStandardMaterial`; loader will set `castShadow=true`.
- Embed textures; avoid external `.bin` + images.

## Attribution slot
When you add a model, append to `public/models/ATTRIBUTION.md`:
```
- Weapon: "M4A1 Tactical" by <author> — https://sketchfab.com/3d-models/... — CC-BY 4.0
```

Current state: **procedural fallback active** — no GLB committed (keeps repo lightweight, runnable offline).
