import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/tests/**/*.test.ts",
      "apps/*/src/**/*.test.ts",
    ],
    exclude: ["node_modules", "dist", "playwright/**", "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.spec.ts", "**/worker*.ts"],
    },
    testTimeout: 5000,
  },
  resolve: {
    alias: {
      "@rts/contracts": path.resolve(import.meta.dirname, "packages/contracts/src"),
      "@rts/simulation": path.resolve(import.meta.dirname, "packages/simulation/src"),
      "@rts/simulation-world": path.resolve(import.meta.dirname, "packages/simulation-world/src"),
      "@rts/renderer": path.resolve(import.meta.dirname, "packages/renderer/src"),
    },
  },
});
