// Tailwind preset for the Phytos "Field Brief" design system (design-system/phytos/MASTER.md).
// Colours resolve to the CSS variables in ./phytos.css, which every app must import.
/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        sheet: 'var(--sheet)',
        navy: { DEFAULT: 'var(--navy)', 2: 'var(--navy-2)', tint: 'var(--navy-tint)' },
        copper: {
          DEFAULT: 'var(--copper)',
          deep: 'var(--copper-deep)',
          light: 'var(--copper-light)',
          tint: 'var(--copper-tint)',
        },
        green: { DEFAULT: 'var(--green)', deep: 'var(--green-deep)', tint: 'var(--green-tint)' },
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)' },
        line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
      },
      fontFamily: {
        display: ['"Source Serif 4 Variable"', 'Georgia', 'serif'],
        body: ['"Atkinson Hyperlegible Next Variable"', 'system-ui', 'sans-serif'],
        mono: ['"Atkinson Hyperlegible Mono Variable"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-xl': ['36px', { lineHeight: '40px', letterSpacing: '-0.01em' }],
        display: ['28px', { lineHeight: '32px', letterSpacing: '-0.005em' }],
        title: ['21px', { lineHeight: '28px' }],
        body: ['18px', { lineHeight: '27px' }],
        'body-sm': ['16px', { lineHeight: '24px' }],
        label: ['15px', { lineHeight: '20px', letterSpacing: '0.01em' }],
        caption: ['13px', { lineHeight: '18px' }],
        eyebrow: ['12px', { lineHeight: '16px', letterSpacing: '0.08em' }],
        data: ['15px', { lineHeight: '22px' }],
      },
      borderRadius: { card: '4px', tag: '2px' },
      borderWidth: { 1.5: '1.5px' },
      boxShadow: { raise: 'var(--raise)' },
      backgroundImage: { hatch: 'var(--hatch)' },
      transitionTimingFunction: { snap: 'cubic-bezier(.2,.8,.2,1)' },
      keyframes: {
        // A status tag arriving: a short fade and settle, once.
        tag: {
          '0%': { transform: 'translateY(-2px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        rung: {
          '0%': { transform: 'translateY(6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        dots: { '0%, 20%': { opacity: '0.2' }, '50%': { opacity: '1' }, '100%': { opacity: '0.2' } },
      },
      animation: {
        tag: 'tag 180ms cubic-bezier(.2,.8,.2,1) both',
        rung: 'rung 200ms cubic-bezier(.2,.8,.2,1) both',
        dots: 'dots 1.2s ease-in-out infinite',
      },
    },
  },
}
