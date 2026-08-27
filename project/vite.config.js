import { defineConfig } from 'vite';
export default defineConfig({
  // dev server — allow any trycloudflare host for public verification
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true,
    allowedHosts: true,
    headers: { 'X-Content-Type-Options': 'nosniff' },
  },
  // preview / production — tmux app-server runs on port 3000 per Agents.md
  preview: {
    host: '0.0.0.0',
    port: 3000,
    cors: true,
    allowedHosts: true,
    strictPort: true,
  },
  build: { outDir: 'dist', assetsDir: 'assets' },
});
