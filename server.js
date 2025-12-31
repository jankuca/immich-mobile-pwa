import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'

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

console.log('Starting server with:')
console.log(`  PORT: ${PORT}`)
console.log(`  IMMICH_API_URL: ${IMMICH_API_URL}`)

// Serve runtime configuration for the frontend
app.get('/config.json', (_req, res) => {
  res.json({
    immichApiUrl: IMMICH_API_URL,
  })
})

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
