import { LocateFixed, LocateOff, MapPin } from 'lucide-react'
import { DISTRICTS, PROVINCES } from '@repo/shared'

export type GpsState = 'searching' | 'found' | 'unavailable'

// Where the report is from. GPS picks the nearest district; the picker is always there to
// correct it, and is the only way when GPS is off. Coordinates are never shown.
export function LocationRow({
  gps,
  district,
  onDistrict,
}: {
  gps: GpsState
  district: string
  onDistrict: (name: string) => void
}) {
  const Icon = gps === 'found' ? LocateFixed : gps === 'searching' ? MapPin : LocateOff
  const status =
    gps === 'found'
      ? 'Found by GPS'
      : gps === 'searching'
        ? 'Finding your location…'
        : 'GPS is off: choose your district'

  return (
    <div>
      <label htmlFor="district" className="eyebrow mb-2 block">
        District
      </label>
      <div className="flex items-center gap-2 pb-2 text-label font-semibold text-ink-2">
        <Icon size={20} strokeWidth={2} aria-hidden />
        <span aria-live="polite">{status}</span>
      </div>
      <select
        id="district"
        value={district}
        onChange={event => onDistrict(event.target.value)}
        className="min-h-14 w-full appearance-none rounded-card border-1.5 border-line-strong bg-sheet px-3 font-body text-body font-semibold text-ink"
      >
        <option value="" disabled>
          Choose a district
        </option>
        {PROVINCES.map(province => (
          <optgroup key={province} label={province}>
            {DISTRICTS.filter(d => d.province === province).map(d => (
              <option key={d.slug} value={d.name}>
                {d.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
