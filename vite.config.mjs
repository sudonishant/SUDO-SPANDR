import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const agentTarget = process.env.AGENT_COMPUTER_TARGET || ''
const agentToken = process.env.AGENT_COMPUTER_TOKEN || ''
const agentNoVncTarget = process.env.AGENT_COMPUTER_NOVNC_TARGET || 'http://127.0.0.1:7860'
const browserIsolationHeaders = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
}
const agentProxy = agentTarget && agentToken ? {
  '/api/v1/agent-computer': {
    target: agentTarget,
    changeOrigin: true,
    rewrite: (requestPath) => requestPath.replace(/^\/api\/v1\/agent-computer/, ''),
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.setHeader('x-agent-computer-token', agentToken)
      })
    },
  },
  '/novnc': {
    target: agentNoVncTarget,
    changeOrigin: true,
    secure: false,
    ws: true,
    rewrite: (requestPath) => requestPath.replace(/^\/novnc/, ''),
    configure: (proxy) => {
      proxy.on('proxyRes', (proxyRes) => {
        proxyRes.headers['cross-origin-embedder-policy'] = 'require-corp'
        proxyRes.headers['cross-origin-opener-policy'] = 'same-origin'
        proxyRes.headers['cross-origin-resource-policy'] = 'same-origin'
      })
    },
  },
} : {}

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
    headers: browserIsolationHeaders,
    proxy: {
      ...agentProxy,
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
    headers: browserIsolationHeaders,
  },
})
