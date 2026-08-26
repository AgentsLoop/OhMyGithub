import { defineConfig } from 'vite';
export default defineConfig({
  server: { port: 3000, host: '0.0.0.0', allowedHosts: true, cors: true },
  preview: { port: 3000, host: '0.0.0.0', allowedHosts: true, cors: true }
});
