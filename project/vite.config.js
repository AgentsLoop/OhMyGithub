import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    headers: { 'X-Frame-Options': 'ALLOWALL' },
    hmr: { host: 'localhost' }
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    headers: { 'X-Frame-Options': 'ALLOWALL' }
  }
});
