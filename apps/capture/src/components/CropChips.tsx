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
      <legend className="eyebrow mb-2">Crop</legend>
      <div className="grid grid-cols-2 gap-3">
        {CROPS.map(crop => {
          const Glyph = GLYPHS[crop]
          const selected = value === crop
          return (
            <label
              key={crop}
              className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-slip border-2 border-ink px-3 text-body font-extrabold transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-copper ${
                selected ? 'bg-ink text-paper shadow-sign-sm' : 'bg-slip text-ink'
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
              <Glyph size={28} strokeWidth={2.25} aria-hidden />
              {CROP_LABELS[crop]}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
