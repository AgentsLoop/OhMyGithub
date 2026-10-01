import { defineConfig } from 'vite';
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.js']
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
