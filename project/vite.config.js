import { defineConfig } from 'vite';
export default defineConfig({
  test: { environment: 'jsdom', globals: true, include: ['src/**/*.test.js'] },
  server: { host: '0.0.0.0', port: 3000, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 3000, allowedHosts: true }
});
