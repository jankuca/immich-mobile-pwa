import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// Configuration from environment variables (required)
const PORT = process.env.PORT
const IMMICH_API_URL = process.env.IMMICH_API_URL
// Optional: API key for auto-login (skips the login screen)
const IMMICH_API_KEY = process.env.IMMICH_API_KEY

if (!PORT) {
  console.error('Error: PORT environment variable is required')
  process.exit(1)
}

if (!IMMICH_API_URL) {
  console.error('Error: IMMICH_API_URL environment variable is required')
  process.exit(1)
}

console.log(`Starting server with:`)
console.log(`  PORT: ${PORT}`)
console.log(`  IMMICH_API_URL: ${IMMICH_API_URL}`)
console.log(`  IMMICH_API_KEY: ${IMMICH_API_KEY ? '(provided)' : '(not set)'}`)

// Proxy API requests to the Immich server
const apiProxy = createProxyMiddleware({
  target: IMMICH_API_URL,
  changeOrigin: true,
  secure: false,
  logger: console,
  on: {
    proxyReq: (proxyReq, req, _res) => {
      console.log(`Proxying: ${req.method} ${req.originalUrl} -> ${IMMICH_API_URL}${proxyReq.path}`)

      // If server has an API key configured, use it for all requests
      if (IMMICH_API_KEY) {
        proxyReq.setHeader('x-api-key', IMMICH_API_KEY)
      }

      // Extract the API key from the query parameters (for client-provided keys)
      const url = new URL(proxyReq.path, 'http://localhost')
      const apiKey = url.searchParams.get('key')

      if (apiKey) {
        // Add the API key as a header (overrides server key if both present)
        proxyReq.setHeader('x-api-key', apiKey)

        // Remove the key from the query parameters
        url.searchParams.delete('key')

        // Update the request URL without the key parameter
        proxyReq.path = url.pathname + url.search
        console.log(`  Removed key from URL, new path: ${proxyReq.path}`)
      }
    },
    error: (err, _req, _res) => {
      console.error('Proxy error:', err)
    },
  },
})

app.use('/api', apiProxy)

// Read and cache the index.html, injecting environment variables
const indexHtmlPath = path.join(__dirname, 'dist', 'index.html')
let indexHtmlContent = null

const getIndexHtml = () => {
  if (indexHtmlContent === null) {
    let html = fs.readFileSync(indexHtmlPath, 'utf-8')

    // Inject a pre-auth flag if API key is configured (don't expose the key itself)
    if (IMMICH_API_KEY) {
      const envScript = `<script>window.__IMMICH_PRE_AUTHENTICATED__ = true;</script>`
      html = html.replace('<head>', `<head>${envScript}`)
    }

    indexHtmlContent = html
  }
  return indexHtmlContent
}

// Serve static files from the dist directory (except index.html which we handle specially)
app.use(
  express.static(path.join(__dirname, 'dist'), {
    index: false, // Don't serve index.html automatically
  }),
)

// Handle SPA routing - serve index.html for all other routes
// Express 5 requires named wildcard parameters
app.get('/{*splat}', (_req, res) => {
  res.type('html').send(getIndexHtml())
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`)
})
