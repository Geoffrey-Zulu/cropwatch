// defineConfig is imported from vitest/config rather than vite so that the
// `test` block below is typed. Importing it from vite leaves `test` unknown.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
