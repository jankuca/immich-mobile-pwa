import preact from '@preact/preset-vite'
import type { Plugin } from 'vite'
import { defineConfig, loadEnv } from 'vite'

// Plugin to serve /config.json with runtime configuration
function runtimeConfigPlugin(immichApiUrl: string): Plugin {
  return {
    name: 'runtime-config',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/config.json') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ immichApiUrl }))
          return
        }
        next()
      })
    },
  }
}

// https://vitejs.dev/config/
// biome-ignore lint/style/noDefaultExport: vite-enforced format
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  const IMMICH_API_URL = env.IMMICH_API_URL

  // Only require IMMICH_API_URL when running the dev server
  if (command === 'serve' && !IMMICH_API_URL) {
    throw new Error('IMMICH_API_URL environment variable is required for dev server')
  }

  return {
    plugins: [preact(), ...(IMMICH_API_URL ? [runtimeConfigPlugin(IMMICH_API_URL)] : [])],
    resolve: {
      alias: {
        react: 'preact/compat',
        'react-dom/test-utils': 'preact/test-utils',
        'react-dom': 'preact/compat',
        'react/jsx-runtime': 'preact/jsx-runtime',
      },
    },
    server: {
      // Enable access from all network interfaces
      host: '0.0.0.0',
      // Allow connections from any origin
      cors: true,
    },
  }
})
