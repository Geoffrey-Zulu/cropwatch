import { Activity, BadgeCheck, CloudSun, type LucideIcon } from 'lucide-react'
import { ALERT_CLASS_LABELS, type AlertClass } from '@repo/shared'

// Solid means verified; dashed means modelled or forecast only (MASTER.md §2).
const TAG: Record<AlertClass, { icon: LucideIcon; className: string }> = {
  weather_advisory: { icon: CloudSun, className: 'border-navy-tint bg-navy-tint text-navy' },
  verified_cluster: { icon: BadgeCheck, className: 'border-navy bg-navy text-white' },
  model_risk_signal: { icon: Activity, className: 'border-dashed border-ink-2 text-ink' },
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
