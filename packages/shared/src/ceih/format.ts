// Words and figures for CEIH factor lines and messages: the same wording on the screen, in the
// SMS and in the tests. No em dashes (CLAUDE.md, Brand and copy).

// "ZMW 5,600"
export const zmw = (amount: number) => `ZMW ${Math.round(amount).toLocaleString('en-GB')}`

// "10 Jan" (the season calendar's date, in UTC).
export function shortDate(iso: string) {
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

// "15%" for a share such as 0.15: an amount rule, never a likelihood.
export const percent = (share: number) => `${Math.round(share * 100)}%`

export const ndviText = (value: number) => value.toFixed(2)

// "+260971234567" → "097 ••• 4567": enough for a person to recognise their own number.
export function maskMsisdn(msisdn: string) {
  const local = `0${msisdn.replace(/^\+260/, '')}`
  return `${local.slice(0, 3)} ••• ${local.slice(-4)}`
}

// Soya stages: VE and VC before V1, then V1, V2…, then the reproductive R stages. The rank is the
// V number (VE, VC = 0), R stages rank above every V stage. Unknown: null, which never counts.
export function stageRank(stage: string | null | undefined): number | null {
  const s = (stage ?? '').trim().toUpperCase()
  if (s === 'VE' || s === 'VC') return 0
  const v = /^V(\d{1,2})$/.exec(s)
  if (v) return Number(v[1])
  const r = /^R(\d)$/.exec(s)
  if (r) return 100 + Number(r[1])
  return null
}
