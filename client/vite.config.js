import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import checker from 'vite-plugin-checker'
import { VitePWA } from 'vite-plugin-pwa'
import viteCompression from 'vite-plugin-compression'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  // Dev-only plugins loaded conditionally
  const isDev = mode !== 'production'

  // Load dev plugins only in development
  const devPlugins = isDev ? [
    // checker({
    //   eslint: {
    //     lintCommand: 'eslint "./src/**/*.{js,jsx}"',
    //     useFlatConfig: true,
    //   },
    //   overlay: true,
    // }),
  ] : []

  return {
    plugins: [
      tailwindcss(),
      react(),
      ...devPlugins, // Click-to-code inspector + debug toolbar (dev only)
      // Brotli compression for production builds (70-80% size reduction)
      viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 10240, // Only compress files > 10KB
        deleteOriginFile: false, // Keep original files
      }),
      // Also create gzip for older browsers
      viteCompression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 10240,
        deleteOriginFile: false,
      }), VitePWA({
        // Use prompt mode to show mandatory update dialog
        // The new SW will wait until user clicks Update
        registerType: 'prompt',
        // Use the hook/manual registration path only; avoid injected scripts that can trip CSP
        injectRegister: null,
        workbox: {
          // Include index.html - required for navigateFallback to work
          globPatterns: ['**/*.{js,css,ico,png,svg,webp,html}'],
          // Don't cache API calls
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [
            /^\/api/,           // API routes
            /^\/__/,            // Internal routes
            /^\/quiz/,          // Secondary apps
            /^\/[a-zA-Z0-9_-]{1,50}$/,  // Short URL patterns (1-50 alphanum chars)
            /^\/[a-zA-Z0-9_-]{1,50}\+$/, // Preview URL patterns (short URL + plus sign)
          ],
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
          lang: 'en',
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
    build: {
      // Enable module preload polyfill for older browsers
      modulePreload: {
        polyfill: true,
      },
      // Optimize chunk splitting for better caching
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Vendor chunks
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) {
              return 'react-vendor'
            }
            if (id.includes('node_modules/clsx/') || id.includes('node_modules/tailwind-merge/')) {
              return 'ui-vendor'
            }
            if (id.includes('node_modules/recharts/')) {
              return 'chart-vendor'
            }
            if (id.includes('node_modules/qrcode.react/')) {
              return 'qr-vendor'
            }

            // Heavy components
            if (
              id.includes('/src/components/admin/ChangelogManager.jsx') ||
              id.includes('/src/components/admin/SystemHealthCard.jsx')
            ) {
              return 'admin-components'
            }

            return undefined
          },
        },
        // Preserve tree-shaking by keeping entry signatures
        preserveEntrySignatures: 'strict',
        treeshake: {
          moduleSideEffects: 'no-external',
          propertyReadSideEffects: false,
        },
      },
      // Optimize chunk size warnings
      chunkSizeWarningLimit: 1000,
      // Use the faster default minifier to avoid terser timing overhead
      minify: 'esbuild',
      // CSS code splitting for better caching
      cssCodeSplit: true,
      // Smaller chunk size for better parallel loading
      cssMinify: 'esbuild',
      // Optimize assets
      assetsInlineLimit: 4096, // Inline assets < 4kb as base64
      // Source maps for production debugging (optional)
      sourcemap: false,
      // Target modern browsers for smaller bundles
      target: 'es2020',
      // Enable CSS minification
      reportCompressedSize: false, // Faster builds
    },
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
