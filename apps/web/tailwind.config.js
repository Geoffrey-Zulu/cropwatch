import phytos from '@repo/ui/theme/tailwind-preset'

// The Command Center's type (design-system/phytos/patterns-v2.md, decision 2): one family,
// Instrument Sans, for all UI text and figures; IBM Plex Mono only for ids, doses, coordinates
// and versions; Bricolage only in the wordmark. The scale is 14 px body, as in all four
// products studied, with 13 px secondary for the projector.
/** @type {import('tailwindcss').Config} */
export default {
  presets: [phytos],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Instrument Sans Variable"', 'system-ui', 'sans-serif'],
        wordmark: ['"Bricolage Grotesque Variable"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['24px', { lineHeight: '32px', letterSpacing: '-0.01em' }],
        display: ['24px', { lineHeight: '32px', letterSpacing: '-0.01em' }],
        stat: ['28px', { lineHeight: '32px', letterSpacing: '-0.01em' }],
        title: ['20px', { lineHeight: '28px', letterSpacing: '-0.005em' }],
        section: ['15px', { lineHeight: '20px' }],
        body: ['14px', { lineHeight: '20px' }],
        'body-sm': ['14px', { lineHeight: '20px' }],
        label: ['14px', { lineHeight: '20px' }],
        caption: ['13px', { lineHeight: '18px' }],
        eyebrow: ['13px', { lineHeight: '18px' }],
        data: ['13px', { lineHeight: '18px' }],
      },
      backgroundColor: { skeleton: 'var(--skeleton)' },
    },
  },
  plugins: [],
}
