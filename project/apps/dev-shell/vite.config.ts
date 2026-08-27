import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: "0.0.0.0",
    allowedHosts: true,
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    hmr: {
      clientPort: 443,
    },
  },
  preview: {
    port: 3000,
    host: "0.0.0.0",
    allowedHosts: true,
    cors: true,
  },
  resolve: {
    alias: {
      "@rts/contracts": path.resolve(__dirname, "../../packages/contracts/src"),
      "@rts/simulation": path.resolve(__dirname, "../../packages/simulation/src"),
      "@rts/simulation-world": path.resolve(__dirname, "../../packages/simulation-world/src"),
      "@rts/renderer": path.resolve(__dirname, "../../packages/renderer/src"),
    },
  },
  worker: { format: "es" },
  build: {
    sourcemap: true,
    outDir: "dist",
  },
});
