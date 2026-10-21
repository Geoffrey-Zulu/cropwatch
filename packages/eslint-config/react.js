// @ts-check
import { defineConfig } from 'eslint/config'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import { SOURCE_FILES, core } from './index.js'

/**
 * Preset for packages containing React components.
 *
 * Adds browser globals and the react-hooks recommended rules on top of `core`,
 * then applies eslint-config-prettier last so it can switch off any formatting
 * rules the earlier configs turned on.
 */
export const react = defineConfig([
  ...core,
  {
    name: 'repo/react-globals',
    files: SOURCE_FILES,
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    name: 'repo/react-hooks',
    files: ['**/*.{jsx,tsx}'],
    // `configs.flat.*` is the flat-config namespace; the top-level
    // `configs.recommended` still carries a legacy string plugin array.
    extends: [reactHooks.configs.flat.recommended],
  },
  eslintConfigPrettier,
])

export default react
