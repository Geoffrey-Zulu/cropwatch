// The Phytos lockup (mockup A): a field-green rounded square with a pale leaf, and the wordmark
// in Fraunces, soft and a little wonky.
export function PhytosMark({ className = 'h-[2.05rem] w-[2.05rem]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={`shrink-0 ${className}`}>
      <rect width="32" height="32" rx="10" fill="#2D5B39" />
      <path d="M8.5 23.5C8.2 14.6 13.6 8.6 23.7 8.3c.3 10-5.5 15.6-15.2 15.2Z" fill="#E4EDCF" />
      <path d="M9.6 22.4 19.6 12.4" stroke="#2D5B39" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function PhytosLogo({ large = false }: { large?: boolean }) {
  return (
    <span className="inline-flex items-center gap-[0.6rem] text-fg">
      <PhytosMark className={large ? 'h-[2.6rem] w-[2.6rem]' : undefined} />
      <span
        className={`font-wordmark font-[640] leading-none tracking-[-0.012em] ${large ? 'text-[2.1rem]' : 'text-[1.6rem]'}`}
        style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1, "opsz" 72' }}
      >
        Phytos
      </span>
    </span>
  )
}
