import { defineConfig } from 'vite';
export default defineConfig({
  test: { include: ['tests/**/*.test.js'] },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    hmr: false,
    allowedHosts: true
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
