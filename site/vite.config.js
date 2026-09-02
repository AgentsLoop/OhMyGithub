import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true, proxy: { '/api': 'http://127.0.0.1:8787', '/auth': 'http://127.0.0.1:8787' } },
  preview: { host: '0.0.0.0', port: 3000, allowedHosts: true },
  build: { outDir: 'dist' }
})
