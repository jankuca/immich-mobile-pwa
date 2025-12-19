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

// Proxy API requests to the Immich server
const apiProxy = createProxyMiddleware({
  target: IMMICH_API_URL,
  changeOrigin: true,
  secure: false,
  logger: console,
  on: {
    proxyReq: (proxyReq, req, _res) => {
      console.log(`Proxying: ${req.method} ${req.originalUrl} -> ${IMMICH_API_URL}${proxyReq.path}`)

      // Extract the API key from the query parameters
      const url = new URL(proxyReq.path, 'http://localhost')
      const apiKey = url.searchParams.get('key')

      if (apiKey) {
        // Add the API key as a header
        proxyReq.setHeader('x-api-key', apiKey)

        // Remove the key from the query parameters
        url.searchParams.delete('key')

        // Update the request URL without the key parameter
        proxyReq.path = url.pathname + url.search
        console.log(`  Removed key from URL, new path: ${proxyReq.path}`)
      }
    },
    error: (err, req, res) => {
      console.error('Proxy error:', err)
    },
  },
})

app.use('/api', apiProxy)

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')))

// Handle SPA routing - serve index.html for all other routes
// Express 5 requires named wildcard parameters
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`)
})
