import { defineConfig } from 'vite';
export default defineConfig({
  server: { host: '0.0.0.0', port: 3000 },
  preview: { host: '0.0.0.0', port: 3000 },
  test: { environment: 'jsdom', include: ['src/**/*.test.js','tests/**/*.test.js'] }
});
