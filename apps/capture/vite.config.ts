// defineConfig comes from vitest/config so the `test` block is typed.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Phytos day exposure (design-system/phytos/MASTER.md): the browser chrome matches the header.
const GROUND = '#F0EDE2'

export default defineConfig({
  server: { port: 5174 },
  preview: { port: 5174 },
  plugins: [
    react(),
    VitePWA({
      // One service worker: the app-shell precache plus FCM background messages (src/sw.ts).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: {
        // The shell, and only the Latin font files: other subsets load on demand if ever needed.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}', '**/*-latin-wght-normal-*.woff2'],
      },
      manifest: {
        id: '/',
        name: 'Phytos',
        short_name: 'Phytos',
        description:
          'Phytos (prototype): photograph a sick crop, get an AI assessment and advice from Zambian guides.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: GROUND,
        theme_color: GROUND,
        categories: ['agriculture', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
