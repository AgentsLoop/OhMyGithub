---
name: three-game-discovery
description: Find newly created browser games, especially Three.js and GPT-6 Astra projects, and verify that repositories are non-empty, playable-looking, and actually use Three.js.
---

# Three.js game discovery

Use this skill when the user asks to find new browser games, Three.js games, or games made with GPT-6 Astra.

## Define the date

Use UTC for repository timestamps. Treat “today” as the current UTC date unless the user gives another date. Separate these meanings:

- `created:` means the GitHub repository was created on that date.
- `pushed:` means an older repository changed on that date.
- Google `after:` and `before:` describe search-index timing, not repository creation.

## Use the high-yield search order

1. Run `scripts/search_github_games.py` with the target date. It combines the focused queries that produced the best results:
   - `three.js game in:description`
   - `threejs game in:description`
   - `"React Three Fiber" game in:description`
   - `webgpu game in:description`
   - `"GPT-6 Astra" in:description`
   - `"GPT-Astra" in:description`
2. Run `scripts/verify_github_games.py` on the result file. Keep only repositories with a non-empty tree and source evidence for Three.js.
3. Inspect the README, package manifest, and a small set of source files. Require one of these markers: `THREE.`, `THREE.WebGLRenderer`, `from 'three'`, `three.module.js`, or `@react-three/`.
4. Classify a project as a game only when its description, README, or source has game evidence such as a player, level, enemy, racer, shooter, physics game, or playable controls. Do not count museums, dashboards, prompt packs, catalogs, or generic Three.js demos as games.
5. For ASTRA attribution, prefer an explicit repository description, README, or creator statement. Mark catalog-only attribution as lower confidence.

## Use these secondary searches

Use Google only for discovery and use GitHub metadata for date verification:

```text
site:github.com/ ("Three.js" OR "three.module.js" OR "@react-three/fiber") (game OR playable OR racer OR shooter) after:YYYY-MM-DD before:YYYY-MM-DD
site:github.io/ ("Three.js" OR "React Three Fiber") (game OR play OR playable) after:YYYY-MM-DD before:YYYY-MM-DD
site:github.com/ ("GPT-6 Astra" OR "GPT-Astra") ("Three.js" OR "React Three Fiber") (game OR racer OR shooter)
```

Use GH Archive when GitHub search has not indexed a new repository. The archive finds public `CreateEvent` repository events, but it does not prove that the repository is a game. Hydrate each candidate with the GitHub API and then run the verifier. The helper `scripts/gh_archive_candidates.py` reads one hourly archive file at a time.

## Handle limits correctly

Do not rotate accounts to evade GitHub rate limits. Check the limit, stop or wait when necessary, and continue with Google, GH Archive, public repository pages, or previously collected candidates. Never print tokens or credentials.

## Report results

For each accepted result, report the repository link, UTC creation time, game type, Three.js evidence, ASTRA evidence, and confidence. Report exclusions briefly when they explain a false positive, such as empty, Canvas 2D, Godot, catalog-only, or non-game.

## Helper scripts

```text
python3 scripts/search_github_games.py --date 2026-09-08 --output candidates.json
python3 scripts/verify_github_games.py --input candidates.json --output verified.json
python3 scripts/gh_archive_candidates.py --date 2026-09-08 --hour 3
```

The scripts require the `gh` CLI for GitHub API calls. They use one authenticated account at a time and do not implement account rotation.
