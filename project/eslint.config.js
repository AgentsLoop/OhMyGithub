import js from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.config.js", "*.config.ts", "e2e/*.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      boundaries,
    },
    settings: {
      "boundaries/include": ["packages/**/*", "apps/**/*"],
      "boundaries/elements": [
        { type: "contracts", pattern: "packages/contracts/*" },
        { type: "simulation", pattern: "packages/simulation/*" },
        { type: "simulation-world", pattern: "packages/simulation-world/*" },
        { type: "renderer", pattern: "packages/renderer/*" },
        { type: "dev-shell", pattern: "apps/dev-shell/*" },
      ],
    },
    rules: {
      // dependency boundaries — matches arch goals: contracts has no deps, simulation has no renderer/DOM
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "contracts", allow: [] },
            { from: "simulation", allow: ["contracts"] },
            { from: "simulation-world", allow: ["contracts", "simulation"] },
            { from: "renderer", allow: ["contracts"] },
            {
              from: "dev-shell",
              allow: ["contracts", "simulation", "simulation-world", "renderer"],
            },
          ],
        },
      ],
      // extra guard: forbid direct Babylon/React imports in forbidden packages — dual check
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@babylonjs/core",
              message: "Only packages/renderer and apps/dev-shell may import Babylon.js",
            },
            {
              name: "react",
              message: "Only apps/dev-shell may import React",
            },
            {
              name: "react-dom",
              message: "Only apps/dev-shell may import ReactDOM",
            },
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      // relax stylistic strictness that conflicts with pragmatic code — keep boundaries strict
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/dot-notation": "off",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/consistent-generic-constructors": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-deprecated": "off",
    },
  },
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "node_modules/**",
      "apps/dev-shell/dist/**",
      ".agents/**",
      "**/*.js",
    ],
  },
  // overrides: allow simulation to not trigger restricted imports rule by itself, but renderer/dev-shell are allowed explicitly via overrides
  {
    files: ["packages/renderer/**/*.{ts,tsx}", "apps/dev-shell/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["packages/contracts/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@babylonjs/core", message: "contracts must have zero Babylon dependency" },
            { name: "@babylonjs/loaders", message: "contracts must have zero Babylon dependency" },
            { name: "react", message: "contracts must have zero React dependency" },
          ],
          patterns: [{ group: ["react*"], message: "contracts must have zero React dependency" }],
        },
      ],
    },
  },
  {
    files: ["packages/simulation/**/*.{ts,tsx}", "packages/simulation-world/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@babylonjs/core", message: "simulation must not import renderer" },
            { name: "@babylonjs/loaders", message: "simulation must not import renderer" },
            { name: "react", message: "simulation must not import React" },
            { name: "react-dom", message: "simulation must not import React" },
          ],
          patterns: [{ group: ["@babylonjs/*"], message: "simulation must not import Babylon" }],
        },
      ],
    },
  },
);
