// Tailwind preset for the Phytos "Field Signal" design system (design-system/phytos/MASTER.md).
// Colours resolve to the CSS variables in ./phytos.css, which every app must import;
// the values switch with the exposure (day by default, `exposure-night` for the Command Center).
/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        ground: 'var(--ground)',
        panel: 'var(--panel)',
        well: 'var(--well)',
        fg: { DEFAULT: 'var(--fg)', 2: 'var(--fg-2)' },
        signal: {
          DEFAULT: 'var(--signal)',
          ink: 'var(--signal-ink)',
          text: 'var(--signal-text)',
          tint: 'var(--signal-tint)',
        },
        leaf: 'var(--leaf)',
        attention: {
          DEFAULT: 'var(--attention)',
          text: 'var(--attention-text)',
          tint: 'var(--attention-tint)',
        },
        high: { DEFAULT: 'var(--high)', ink: 'var(--high-ink)', text: 'var(--high-text)' },
        hairline: { DEFAULT: 'var(--hairline)', strong: 'var(--hairline-strong)' },
        chip: { DEFAULT: 'var(--chip)', fg: 'var(--chip-fg)' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', 'system-ui', 'sans-serif'],
        body: ['"Instrument Sans Variable"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        stat: ['40px', { lineHeight: '40px', letterSpacing: '-0.02em' }],
        'display-xl': ['36px', { lineHeight: '40px', letterSpacing: '-0.01em' }],
        display: ['28px', { lineHeight: '32px', letterSpacing: '-0.005em' }],
        title: ['21px', { lineHeight: '28px' }],
        body: ['18px', { lineHeight: '27px' }],
        'body-sm': ['16px', { lineHeight: '24px' }],
        label: ['15px', { lineHeight: '20px', letterSpacing: '0.01em' }],
        caption: ['13px', { lineHeight: '18px' }],
        eyebrow: ['12px', { lineHeight: '16px', letterSpacing: '0.12em' }],
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
        dots: {
          '0%, 20%': { opacity: '0.2' },
          '50%': { opacity: '1' },
          '100%': { opacity: '0.2' },
        },
      },
      animation: {
        tag: 'tag 180ms cubic-bezier(.2,.8,.2,1) both',
        rung: 'rung 200ms cubic-bezier(.2,.8,.2,1) both',
        dots: 'dots 1.2s ease-in-out infinite',
      },
    },
  },
}
