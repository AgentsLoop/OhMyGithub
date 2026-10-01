# NIGHTSHIFT // Range Protocol

A compact Three.js first-person shooter prototype with pointer-lock movement, mouse aim, WASD and sprint movement, semi-auto fire, reload timing, raycast hit feedback, enemy waves, damage, score, and a responsive tactical HUD.

## Run

```sh
npm install
npm run dev -- --host 0.0.0.0
```

Click `ENTER RANGE`, then use `WASD`, mouse, left click, `Shift`, and `R`.

## Asset attribution

The arena uses two copies of the normalized GLB asset `Sci-fi Crate` by **starkerg**, downloaded from Sketchfab and released under **CC Attribution**.

- Model: [Sketchfab Sci-fi Crate](https://sketchfab.com/3d-models/none-23af43363ba84509ae7ab7a1ff1580c4)
- Author: [starkerg](https://sketchfab.com/starkerg)
- UID: `23af43363ba84509ae7ab7a1ff1580c4`
- Original: `public/models/sci-fi-crate.glb`
- Integrated normalized asset: `public/models/sci-fi-crate-normalized.glb`
- Generated sidecar: `public/models/sci-fi-crate-normalized.glb.attribution.json`

The original asset was inspected with the bundled `inspect_glb.mjs` script before integration. It contained 19 meshes, 4,064 faces, 5 materials, one embedded 512px texture, and the archived `KHR_materials_pbrSpecularGlossiness` extension. The bundled safe normalizer converted all five simple materials to core metallic-roughness materials; the integrated asset has no required extensions and retains the embedded texture.
