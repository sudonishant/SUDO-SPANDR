import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Dev/preview servers accept the sandbox preview host so the app can be opened
// from the workspace viewer as well as from localhost.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'iconv-lite': path.resolve('./src/lib/iconv-lite-browser.js'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: false,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
