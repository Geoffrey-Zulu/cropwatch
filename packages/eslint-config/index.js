// @ts-check
import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * Extensions every preset lints.
 *
 * ESLint only lints .js/.mjs/.cjs by default plus whatever extensions a config
 * lists in `files`, so TypeScript has to be named explicitly here or directory
 * based runs silently skip it.
 *
 * Globs in a shared config are resolved relative to the *consuming* config
 * file, so everything here stays `**`-prefixed and never assumes a layout.
 */
export const SOURCE_FILES = ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}']

/**
 * Shared building block: JS and TypeScript recommended rules, with no
 * formatting rules and no type-aware linting.
 *
 * Exported separately from `base` so the React preset can insert its own
 * blocks before eslint-config-prettier, which has to stay last.
 *
 * Type-aware linting is deliberately off: no `project` or `projectService` is
 * set in `parserOptions`, and no `*TypeChecked` preset is extended.
 */
export const core = defineConfig([
  {
    // A config object with only `ignores` applies repo-wide.
    ignores: ['**/dist/**', '**/coverage/**', '**/.turbo/**'],
  },
  {
    name: 'repo/core',
    files: SOURCE_FILES,
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      // Replaces the eslintrc `env: { node: true }`, which ESLint 10 removed.
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
])

/** Default preset, for packages with no browser or React code. */
export const base = defineConfig([...core, eslintConfigPrettier])

export default base
