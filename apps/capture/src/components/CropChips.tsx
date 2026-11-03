import { Bean, Carrot, Cherry, LeafyGreen, Wheat, type LucideIcon } from 'lucide-react'
import { CROP_LABELS, CROPS, type Crop } from '@repo/shared'

// No icon set draws maize or cassava, so each glyph is a stand-in and the label always shows.
const GLYPHS: Record<Crop, LucideIcon> = {
  maize: Wheat,
  tomato: Cherry,
  cabbage: LeafyGreen,
  cassava: Carrot,
  soybean: Bean,
}

export function CropChips({
  value,
  onChange,
}: {
  value: Crop | null
  onChange: (crop: Crop) => void
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-label font-semibold text-fg">Crop</legend>
      {/* A's toggle: a white pill group, the chosen crop filled field green. */}
      <div className="flex flex-wrap gap-1 rounded-[1.75rem] bg-panel p-1.5 shadow-island-sm">
        {CROPS.map(crop => {
          const Glyph = GLYPHS[crop]
          const selected = value === crop
          return (
            <label
              key={crop}
              className={`flex min-h-14 flex-auto cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-[16px] font-semibold leading-5 transition-colors duration-300 ease-out has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-signal ${
                selected
                  ? 'bg-signal text-signal-ink'
                  : 'text-fg hover:bg-[var(--hover)] active:bg-well'
              }`}
            >
              <input
                type="radio"
                name="crop"
                value={crop}
                checked={selected}
                onChange={() => onChange(crop)}
                className="sr-only"
              />
              <Glyph size={22} strokeWidth={2} aria-hidden />
              {CROP_LABELS[crop]}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
