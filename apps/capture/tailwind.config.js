import fieldSlip from '@repo/ui/theme/tailwind-preset'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [fieldSlip],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  plugins: [],
}
