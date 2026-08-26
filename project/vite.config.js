import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: false
  },
  preview: {
    port: 3000,
    host: '0.0.0.0'
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.js', 'tests/**/*.js']
  }
});
