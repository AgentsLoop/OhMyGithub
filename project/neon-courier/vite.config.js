import { defineConfig } from 'vite';
import { resolve } from 'path';
export default defineConfig({
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true, cors: true },
  preview: { host: '0.0.0.0', port: 3000, allowedHosts: true, cors: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        branch: resolve(__dirname, 'branch.html'),
      },
    },
  },
});
