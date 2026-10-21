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
  {
    // CropWatch invariants 2 and 3: UI code never touches a model confidence number, a
    // severity percentage or a probability. Render the qualitative bands instead.
    name: 'repo/ui-no-numeric-confidence',
    files: SOURCE_FILES,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Identifier[name=/^(model_confidence|modelConfidence|severity_pct|severityPct)$/]',
          message: 'UI code must not read model numbers; render confidence_band / severity_band.',
        },
        {
          selector: 'Identifier[name=/probab|percent/i]',
          message: 'No probabilities or percentages in UI code (CropWatch invariant 2).',
        },
        {
          selector: 'Literal[value=/^(model_confidence|severity_pct)$/]',
          message: 'UI code must not read model numbers; render confidence_band / severity_band.',
        },
      ],
    },
  },
  eslintConfigPrettier,
])

export default react
