// Bundles the Cloud Run server into one ESM file. Workspace packages (@repo/*) ship TypeScript
// source, so they are bundled; third-party dependencies (firebase-admin, @google/genai, grpc…)
// stay external and come from production node_modules (pnpm deploy, see Dockerfile), because
// several load data files at runtime that a bundle would break.
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

const { dependencies } = JSON.parse(readFileSync('package.json', 'utf8'))

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
  external: Object.keys(dependencies).filter(name => !name.startsWith('@repo/')),
  // Lets bundled CommonJS code require() Node built-ins from ESM output.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
})
