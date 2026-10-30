import phytos from '@repo/ui/theme/tailwind-preset'

// The Command Center in mockup A's language (Field-airy, chosen 30 Oct; the contract is
// apps/web/public/mockups/a-field-airy.html): Figtree for UI text, Fraunces for titles, figures
// and the wordmark, IBM Plex Mono only for ids, doses, coordinates and versions. Sizes are in
// rem on A's 15 px root, which grows to 17 and 19 px on wide screens for the projector.
/** @type {import('tailwindcss').Config} */
export default {
  presets: [phytos],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        body: ['"Figtree Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
        wordmark: ['"Fraunces Variable"', 'Georgia', 'serif'],
      },
      fontSize: {
        'display-xl': ['2.35rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        display: ['2.35rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        stat: ['2.2rem', { lineHeight: '1', letterSpacing: '-0.025em' }],
        title: ['1.6rem', { lineHeight: '1.1', letterSpacing: '-0.012em' }],
        section: ['1.1rem', { lineHeight: '1.4' }],
        body: ['0.95rem', { lineHeight: '1.45' }],
        'body-sm': ['0.93rem', { lineHeight: '1.4' }],
        label: ['0.93rem', { lineHeight: '1.4' }],
        caption: ['0.84rem', { lineHeight: '1.35' }],
        eyebrow: ['0.84rem', { lineHeight: '1.35' }],
        data: ['0.86rem', { lineHeight: '1.35' }],
      },
      borderRadius: {
        card: '1.1rem',
        island: '1.6rem',
        pill: '999px',
        tag: '0.28rem',
      },
      boxShadow: {
        raise: 'var(--raise)',
        island: 'var(--raise)',
        'island-sm': 'var(--raise-sm)',
      },
      colors: {
        'fg-3': 'var(--fg-3)',
        land: 'var(--land)',
      },
      backgroundColor: { skeleton: 'var(--skeleton)' },
      transitionTimingFunction: {
        // The motion spec: 250 to 400 ms, ease-out, no bounce.
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
