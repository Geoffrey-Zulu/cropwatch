import fieldSlip from '@repo/ui/theme/tailwind-preset'

// Field-airy reskin (31 Oct; design-system/phytos/MASTER.md). The preset's colour names stay and
// resolve to the variables src/style.css re-points at mockup A's palette; type, radii, shadows
// and motion are A's, set here so the shared preset (and the dashboard) are untouched.
/** @type {import('tailwindcss').Config} */
export default {
  presets: [fieldSlip],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        land: 'var(--land)',
        attention: { stripe: 'var(--elev-stripe)' },
      },
      fontFamily: {
        // Fraunces for display headings, soft and upright, as A sets its titles.
        display: [
          '"Fraunces Variable", Georgia, serif',
          { fontVariationSettings: '"SOFT" 100, "WONK" 0, "opsz" 72' },
        ],
        // Figtree for all UI text.
        body: ['"Figtree Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Doses and ids only.
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-xl': ['34px', { lineHeight: '38px', letterSpacing: '-0.02em' }],
        display: ['29px', { lineHeight: '34px', letterSpacing: '-0.018em' }],
        title: ['21px', { lineHeight: '26px', letterSpacing: '-0.01em' }],
        body: ['17px', { lineHeight: '26px' }],
        'body-sm': ['16px', { lineHeight: '24px' }],
        label: ['15px', { lineHeight: '21px' }],
        caption: ['13px', { lineHeight: '18px' }],
        eyebrow: ['14px', { lineHeight: '20px', letterSpacing: '0.005em' }],
        data: ['15px', { lineHeight: '22px' }],
      },
      borderRadius: {
        // An island on a phone (A's --r-xl at phone width).
        card: '1.35rem',
        // Chips, tags and markers are pills.
        tag: '999px',
        // Boxes inside an island (A's --r-lg) and form controls.
        inner: '1.1rem',
        control: '1rem',
      },
      boxShadow: {
        island: 'var(--shadow)',
        'island-sm': 'var(--shadow-sm)',
        header: 'var(--shadow-header)',
      },
      transitionTimingFunction: { out: 'cubic-bezier(.2,.8,.2,1)' },
      // State changes only, 300 to 360 ms, easing out; style.css honours reduced motion.
      animation: {
        tag: 'tag 300ms cubic-bezier(.2,.8,.2,1) both',
        rung: 'rung 360ms cubic-bezier(.2,.8,.2,1) both',
      },
    },
  },
}
