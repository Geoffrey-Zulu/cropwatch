import { Activity, BadgeCheck, CloudSun, type LucideIcon } from 'lucide-react'
import { ALERT_CLASS_LABELS, type AlertClass } from '@repo/shared'

// Solid means verified (lit in signal); dashed means modelled or forecast only (MASTER.md §2).
const TAG: Record<AlertClass, { icon: LucideIcon; className: string }> = {
  weather_advisory: {
    icon: CloudSun,
    className: 'border-dashed border-hairline-strong text-fg-2',
  },
  verified_cluster: { icon: BadgeCheck, className: 'border-signal-text text-signal-text' },
  model_risk_signal: {
    icon: Activity,
    className: 'border-dashed border-attention text-attention-text',
  },
}

export function AlertClassTag({ alertClass }: { alertClass: AlertClass }) {
  const { icon: Icon, className } = TAG[alertClass]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-tag border-1.5 px-1.5 py-0.5 font-mono text-eyebrow font-semibold uppercase ${className}`}
    >
      <Icon size={14} strokeWidth={2} aria-hidden />
      {ALERT_CLASS_LABELS[alertClass]}
    </span>
  )
}
