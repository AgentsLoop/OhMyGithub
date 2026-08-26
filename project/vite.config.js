import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: false,
    allowedHosts: true,
    cors: true,
    hmr: {
      clientPort: 443
    }
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    cors: true
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.js', 'tests/**/*.js']
  }
});
