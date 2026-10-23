// Tailwind preset for the "Field Slip" design system (design-system/cropwatch/MASTER.md).
// Colours resolve to the CSS variables in ./fieldslip.css, which every app must import.
/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        slip: 'var(--slip)',
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)' },
        rule: 'var(--rule)',
        signboard: 'var(--signboard)',
        copper: { DEFAULT: 'var(--copper)', bright: 'var(--copper-bright)' },
        maize: 'var(--maize)',
        leaf: 'var(--leaf)',
        laterite: 'var(--laterite)',
      },
      fontFamily: {
        stencil: ['"Big Shoulders Stencil Variable"', 'Impact', 'sans-serif'],
        display: ['"Big Shoulders Variable"', 'Impact', 'sans-serif'],
        body: ['"Atkinson Hyperlegible Next Variable"', 'system-ui', 'sans-serif'],
        mono: ['"Atkinson Hyperlegible Mono Variable"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-xl': ['44px', { lineHeight: '44px' }],
        display: ['32px', { lineHeight: '34px' }],
        title: ['22px', { lineHeight: '28px' }],
        body: ['18px', { lineHeight: '27px' }],
        label: ['15px', { lineHeight: '20px', letterSpacing: '0.02em' }],
        eyebrow: ['13px', { lineHeight: '16px', letterSpacing: '0.08em' }],
        data: ['16px', { lineHeight: '22px' }],
      },
      borderRadius: { slip: '6px', input: '4px', stamp: '3px' },
      borderWidth: { 2.5: '2.5px' },
      boxShadow: { sign: 'var(--shadow-sign)', 'sign-sm': 'var(--shadow-sign-sm)' },
      transitionTimingFunction: { snap: 'cubic-bezier(.2,.8,.2,1)' },
      keyframes: {
        // A rubber stamp pressed once onto the slip.
        stamp: {
          '0%': { transform: 'rotate(-3deg) scale(1.18)', opacity: '0' },
          '60%': { transform: 'rotate(-3deg) scale(0.97)', opacity: '1' },
          '100%': { transform: 'rotate(-3deg) scale(1)', opacity: '1' },
        },
        rung: {
          '0%': { transform: 'translateY(6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        dots: { '0%, 20%': { opacity: '0.2' }, '50%': { opacity: '1' }, '100%': { opacity: '0.2' } },
      },
      animation: {
        stamp: 'stamp 220ms cubic-bezier(.2,.8,.2,1) both',
        rung: 'rung 200ms cubic-bezier(.2,.8,.2,1) both',
        dots: 'dots 1.2s ease-in-out infinite',
      },
    },
  },
}
