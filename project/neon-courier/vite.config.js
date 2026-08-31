import { defineConfig } from 'vite';
export default defineConfig({
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true, cors: true, headers: { 'X-Content-Type-Options': 'nosniff' } },
  preview: { host: '0.0.0.0', port: 3000, strictPort: true, allowedHosts: true, cors: true }
});
