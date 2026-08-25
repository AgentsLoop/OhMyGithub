import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    hmr: {
      host: 'localhost'
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
    include: ['tests/**/*.test.js']
  }
});
