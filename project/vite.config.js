import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    cors: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    hmr: { clientPort: 443 }
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    cors: true,
    headers: { 'Access-Control-Allow-Origin': '*' }
  },
  build: { outDir: 'dist' }
});
