// defineConfig is imported from vitest/config rather than vite so that the
// `test` block below is typed. Importing it from vite leaves `test` unknown.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Two apps from one kit: the agribusiness dashboard (index.html → dist) and, with
// `--mode farmer`, the farmer app (farmer.html → dist-farmer, its own Hosting site).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build:
    mode === 'farmer'
      ? { outDir: 'dist-farmer', rollupOptions: { input: 'farmer.html' } }
      : undefined,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
}))
