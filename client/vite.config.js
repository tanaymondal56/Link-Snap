/* eslint-env node */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import checker from 'vite-plugin-checker'
import { VitePWA } from 'vite-plugin-pwa'

// Dev-only plugins loaded conditionally
const isDev = process.env.NODE_ENV !== 'production'

// https://vite.dev/config/
export default defineConfig(async () => {
  // Load dev plugins only in development
  const devPlugins = isDev ? [
    (await import('vite-plugin-react-inspector')).default(),
    (await import('vite-plugin-devtools')).default({})
  ] : []

  return {
    plugins: [
      react(),
      ...devPlugins, // Click-to-code inspector + debug toolbar (dev only)
      checker({
        eslint: {
          lintCommand: 'eslint "./src/**/*.{js,jsx}"',
          useFlatConfig: true, // We are using ESLint 9+
        },
        overlay: isDev, // Only show errors in browser overlay during dev
      }),
    VitePWA({
      // Use prompt mode to show mandatory update dialog
      // The new SW will wait until user clicks Update
      registerType: 'prompt',
      workbox: {
        // Include index.html - required for navigateFallback to work
        globPatterns: ['**/*.{js,css,ico,png,svg,webp,html}'],
        // Don't cache API calls
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/__/],
        // IMPORTANT: Must be false for prompt mode!
        // skipWaiting:false means new SW waits until updateServiceWorker(true) is called
        skipWaiting: false,
        // clientsClaim:false means old SW keeps control until page reload
        clientsClaim: false,
        // Force SW update when any precached file changes
        cleanupOutdatedCaches: true,
        // Use network-first for HTML navigation requests
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      includeAssets: ['favicon.svg', 'favicon-32x32.png', 'favicon-16x16.png', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'Link Snap',
        short_name: 'LinkSnap',
        description: 'Advanced URL Shortener with Analytics',
        theme_color: '#8b5cf6',
        background_color: '#030712', // gray-950 to match app
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      devOptions: {
        enabled: false // Disable PWA in development to avoid caching issues
      }
    }),
  ],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        // Forward the original client IP to the backend for IP whitelisting
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Get the real client IP from the incoming request
            const clientIP = req.socket.remoteAddress;
            if (clientIP) {
              // Set X-Forwarded-For header so backend can see original IP
              proxyReq.setHeader('X-Forwarded-For', clientIP);
              proxyReq.setHeader('X-Real-IP', clientIP);
            }
          });
        },
      },
    },
  },
  }
})
