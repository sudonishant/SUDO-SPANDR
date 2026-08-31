import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'iconv-lite': fileURLToPath(new URL('./src/lib/iconv-lite-browser.js', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0'
  }
})
