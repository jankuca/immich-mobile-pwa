import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [preact()],
	resolve: {
		alias: {
			'react': 'preact/compat',
			'react-dom/test-utils': 'preact/test-utils',
			'react-dom': 'preact/compat',
			'react/jsx-runtime': 'preact/jsx-runtime'
		}
	},
	server: {
		// Enable access from all network interfaces
		host: '0.0.0.0',
		// Allow connections from any origin
		cors: true,
		proxy: {
			// Proxy all API requests to the Immich server
			'/api': {
				target: 'http://100.64.0.1:2283',
				changeOrigin: true,
				secure: false,
				// Configure the proxy to handle the API key
				configure: (proxy, _options) => {
					proxy.on('proxyReq', (proxyReq, req, _res) => {
						// Extract the API key from the query parameters
						const url = new URL(req.url, 'http://localhost');
						const apiKey = url.searchParams.get('key');

						if (apiKey) {
							// Add the API key as a header
							proxyReq.setHeader('x-api-key', apiKey);

							// Remove the key from the query parameters
							url.searchParams.delete('key');

							// Update the request URL without the key parameter
							proxyReq.path = url.pathname + url.search;
						}
					});
				},
			},
		},
	},
});
