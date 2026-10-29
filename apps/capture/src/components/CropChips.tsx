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
      <div className="grid grid-cols-2 gap-3">
        {CROPS.map(crop => {
          const Glyph = GLYPHS[crop]
          const selected = value === crop
          return (
            <label
              key={crop}
              className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-card border-1.5 px-3 text-body font-extrabold transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-attention ${
                selected ? 'border-fg bg-fg text-ground' : 'border-hairline-strong bg-panel text-fg'
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
              <Glyph size={26} strokeWidth={2} aria-hidden />
              {CROP_LABELS[crop]}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
