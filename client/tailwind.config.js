/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Aggressive CSS purging for production
  safelist: [],
  // Remove unused utilities more aggressively
  future: {
    removeDeprecatedGapUtilities: true,
    purgeLayersByDefault: true,
  },
}

