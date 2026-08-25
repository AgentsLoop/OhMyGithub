import { defineConfig } from 'vite';
export default defineConfig({
  server: { host: '0.0.0.0', port: 3000, strictPort: true, cors: true, allowedHosts: true, headers: { 'Access-Control-Allow-Origin': '*' } },
  preview: { host: '0.0.0.0', port: 3000, strictPort: true, cors: true, allowedHosts: true },
  test: { environment: 'jsdom', include: ['src/**/*.test.js','tests/**/*.test.js'] }
});
