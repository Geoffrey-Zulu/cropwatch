// Repo-root ESLint config.
//
// Named .mjs rather than .js because the root package.json has no
// `"type": "module"`; every workspace package that does sets one is free to use
// eslint.config.js.
//
// From ESLint 10 config lookup starts at each linted file's directory and stops
// at the first eslint.config.* it finds, so this config governs root-level
// files only. Files under apps/* and packages/* resolve their own package
// config instead, and those do not inherit from this one.
import base from '@repo/eslint-config'

export default base
