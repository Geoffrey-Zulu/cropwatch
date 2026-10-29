import phytos from '@repo/ui/theme/tailwind-preset'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [phytos],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  plugins: [],
}
