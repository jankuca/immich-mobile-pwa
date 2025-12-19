import preact from '@preact/preset-vite'
import { defineConfig, loadEnv } from 'vite'

// https://vitejs.dev/config/
// biome-ignore lint/style/noDefaultExport: vite-enforced format
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  const IMMICH_API_URL = env.IMMICH_API_URL
  const IMMICH_API_KEY = env.IMMICH_API_KEY

  // Only require IMMICH_API_URL when running the dev server
  if (command === 'serve' && !IMMICH_API_URL) {
    throw new Error('IMMICH_API_URL environment variable is required for dev server')
  }

  return {
    plugins: [preact()],
    // Expose pre-auth flag to the client (not the API key itself)
    define: {
      'import.meta.env.VITE_IMMICH_PRE_AUTHENTICATED': JSON.stringify(!!IMMICH_API_KEY),
    },
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
      proxy: IMMICH_API_URL
        ? {
            // Proxy all API requests to the Immich server
            '/api': {
              target: IMMICH_API_URL,
              changeOrigin: true,
              secure: false,
              // Configure the proxy to handle the API key
              configure: (proxy, _options) => {
                proxy.on('proxyReq', (proxyReq, req, _res) => {
                  // If dev server has an API key configured, use it for all requests
                  if (IMMICH_API_KEY) {
                    proxyReq.setHeader('x-api-key', IMMICH_API_KEY)
                  }

                  // Extract the API key from the query parameters (for client-provided keys)
                  const url = new URL(String(req.url), 'http://localhost')
                  const apiKey = url.searchParams.get('key')

                  if (apiKey) {
                    // Add the API key as a header (overrides server key if both present)
                    proxyReq.setHeader('x-api-key', apiKey)

                    // Remove the key from the query parameters
                    url.searchParams.delete('key')

                    // Update the request URL without the key parameter
                    proxyReq.path = url.pathname + url.search
                  }
                })
              },
            },
          }
        : {},
    },
  }
})
