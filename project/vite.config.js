import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    cors: true,
    allowedHosts: true,
    hmr: { clientPort: 443 }
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    cors: true
  }
});
