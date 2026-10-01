import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    cors: true,
    allowedHosts: true,
    hmr: { clientPort: 443 },
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    cors: true,
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['**/node_modules/**', '**/.agents/**', '**/dist/**'],
    include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}']
  }
});
