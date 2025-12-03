import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import Inspector from 'vite-plugin-react-inspector'
import VitePluginDevTools from 'vite-plugin-devtools'
import checker from 'vite-plugin-checker'

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
  ],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
