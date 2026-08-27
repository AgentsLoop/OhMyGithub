# Pinning

All commands must behave identically locally and in CI.

- Node: `22.23.2` — see `.nvmrc` and `.node-version` (both contain `22.23.2`)
- pnpm: `9.12.3` — see `package.json#packageManager: "pnpm@9.12.3"` and `pnpm-workspace.yaml`
- Core deps pinned via `pnpm-lock.yaml` (committed). Regenerate with `pnpm install --frozen-lockfile` in CI.

CI should run:

```yaml
- uses: pnpm/action-setup@v4
  with: { version: 9.12.3 }
- uses: actions/setup-node@v4
  with: { node-version-file: ".nvmrc", cache: "pnpm" }
- run: pnpm install --frozen-lockfile
- run: pnpm check # typecheck + lint + format + test
- run: pnpm build
- run: pnpm test:e2e # needs playwright browsers: pnpm exec playwright install --with-deps chromium
```

No global installs besides `corepack enable`.
