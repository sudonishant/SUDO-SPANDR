import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'iconv-lite': path.resolve('./src/lib/iconv-lite-browser.js'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0'
  }
})
