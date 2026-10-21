// Bundles the Cloud Run server into one ESM file. Workspace packages such as @repo/shared
// ship TypeScript source, so they must be bundled rather than resolved at runtime.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
  // Lets bundled CommonJS dependencies require() Node built-ins from ESM output.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
})
