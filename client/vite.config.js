import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import Inspector from 'vite-plugin-react-inspector'
import VitePluginDevTools from 'vite-plugin-devtools'
import checker from 'vite-plugin-checker'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    Inspector(), // Click-to-code inspector
    VitePluginDevTools({}), // The "Floater" debug toolbar
    checker({
      eslint: {
        lintCommand: 'eslint "./src/**/*.{js,jsx}"',
        useFlatConfig: true, // We are using ESLint 9+
      },
      overlay: true, // Shows errors in browser overlay
    }),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        // Don't cache API calls
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
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
})
