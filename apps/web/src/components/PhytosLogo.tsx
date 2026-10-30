// The Phytos lockup for the console: the app icon's leaf on the ink chip, without its gold
// marker (amber is for risk only on the console), and the wordmark in Bricolage, the only place
// the console uses it (patterns-v2.md decision 2).
export function PhytosMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden className="shrink-0">
      <rect width="512" height="512" rx="112" fill="var(--chip)" />
      <g
        transform="rotate(-30 256 256)"
        fill="none"
        stroke="var(--chip-fg)"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M256 92C366 166 366 346 256 420C146 346 146 166 256 92Z" strokeWidth="34" />
        <path d="M256 150V372" strokeWidth="26" />
        <path
          d="M256 236L310 196M256 300L316 258M256 236L202 196M256 300L196 258"
          strokeWidth="20"
        />
      </g>
    </svg>
  )
}

export function PhytosLogo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <PhytosMark size={size} />
      <span
        className="font-wordmark font-extrabold leading-none tracking-[-0.01em] text-fg"
        style={{ fontSize: Math.round(size * 0.72) }}
      >
        Phytos
      </span>
    </span>
  )
}
