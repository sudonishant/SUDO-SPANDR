import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import ipContextHandler from './api/v1/ip-context.js'

// Run the same real serverless IP provider handler during local development.
// This avoids mocked browser geolocation while production continues to use the
// existing api/v1/ip-context.js function.
function localServerlessHandlers() {
  const ipContext = async (req, res) => {
    try {
      const chunks = []
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > 65_536) {
          res.statusCode = 413
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ status: 'invalid_request', message: 'IP lookup request is too large.' }))
          return
        }
        chunks.push(chunk)
      }
      const raw = Buffer.concat(chunks).toString('utf8')
      req.body = raw ? JSON.parse(raw) : {}
      res.status = (code) => { res.statusCode = code; return res }
      res.json = (payload) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(payload))
        return res
      }
      await ipContextHandler(req, res)
    } catch {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ status: 'invalid_request', message: 'Expected a valid JSON IP lookup request.' }))
    }
  }
  return {
    name: 'spandr-local-serverless-handlers',
    configureServer(server) { server.middlewares.use('/api/v1/ip-context', ipContext) },
    configurePreviewServer(server) { server.middlewares.use('/api/v1/ip-context', ipContext) },
  }
}

const agentTarget = process.env.AGENT_COMPUTER_TARGET || ''
const agentToken = process.env.AGENT_COMPUTER_TOKEN || ''
const agentNoVncTarget = process.env.AGENT_COMPUTER_NOVNC_TARGET || 'http://127.0.0.1:7860'
const reaTarget = process.env.REA_PROXY_TARGET || ''
const reaToken = process.env.REA_SERVICE_TOKEN || ''
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

const reaProxy = reaTarget && reaToken ? {
  '/api/v1/rea': {
    target: reaTarget,
    changeOrigin: true,
    rewrite: (requestPath) => requestPath.replace(/^\/api\/v1\/rea/, ''),
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.setHeader('x-rea-token', reaToken)
      })
    },
  },
} : {}

const apiTarget = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000'
const analysisProxy = {
  // Keep local development on the same browser endpoint as the existing
  // serverless proxy while routing the metadata-only operation to FastAPI.
  '/api/v1/analyze-eml': {
    target: apiTarget,
    changeOrigin: true,
    rewrite: (requestPath) => requestPath.includes('operation=graph')
      ? requestPath.replace('/api/v1/analyze-eml', '/api/v1/evidence-graph')
      : requestPath,
  },
}

const localApiProxy = {
  ...agentProxy,
  ...reaProxy,
  ...analysisProxy,
  '/api': {
    target: apiTarget,
    changeOrigin: true,
  },
}

// Dev/preview servers accept the sandbox preview host so the app can be opened
// from the workspace viewer as well as from localhost.
export default defineConfig({
  plugins: [react(), localServerlessHandlers()],
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
    proxy: localApiProxy,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
    headers: browserIsolationHeaders,
    proxy: localApiProxy,
  },
})
