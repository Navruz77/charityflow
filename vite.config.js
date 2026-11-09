import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// base is '/' since the Express server on Render serves dist/ at the root
// (no GitHub Pages subpath anymore).
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    // M5 offline (S5.1 to S5.3). vite-plugin-pwa writes a service worker
    // that stores the app's files on the first visit, so later visits work
    // with no connection.
    VitePWA({
      // A new version downloads in the background, then waits: the app shows
      // a "Reload" banner (src/components/UpdateBanner.jsx) and nothing
      // reloads until the person taps it, so nothing being typed is lost.
      // (Changed from the plan's autoUpdate with the user's agreement.)
      registerType: 'prompt',
      injectRegister: false, // UpdateBanner registers the service worker
      manifest: {
        name: 'CharityFlow',
        short_name: 'CharityFlow',
        description: 'A free, guided Zakat calculator that explains every line and works offline.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f7f6f3',
        theme_color: '#1f6f5c',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        cleanupOutdatedCaches: true,
        // Take charge of the page on the very first visit, so that visit's
        // prices are already kept for offline use.
        clientsClaim: true,
        // Hash routes (#/calculator) all load index.html. Never answer an
        // /api request with the page.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Only /api/prices is ever cached: network first, and the last good
        // response when offline. Account data (/api/calculations, sessions)
        // is never stored by the service worker.
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/api/prices',
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'cf-prices',
              expiration: { maxEntries: 1 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  // In `npm run dev`, send /api calls to the Express server (npm start).
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: { environment: 'node', include: ['src/**/*.test.js', 'server/**/*.test.js'] },
})
