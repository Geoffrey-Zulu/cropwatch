import { Camera, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'

// The camera, through the file input: on Android Chrome `capture` opens the rear camera
// straight away, and it falls back to the gallery anywhere else.
export function CaptureTile({
  photo,
  onPhoto,
}: {
  photo: Blob | null
  onPhoto: (file: File) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  // Release the previous photo's memory when it is replaced or the tile goes away.
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview])

  const choose = () => input.current?.click()

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Photo of the damaged crop"
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) onPhoto(file)
          event.target.value = ''
        }}
      />
      {preview ? (
        <div className="relative overflow-hidden rounded-slip border-2 border-ink bg-ink">
          <img src={preview} alt="Your photo" className="aspect-[4/3] w-full object-cover" />
          <button type="button" onClick={choose} className="btn-quiet absolute bottom-3 right-3">
            <RotateCcw size={20} strokeWidth={2.25} aria-hidden />
            Retake
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={choose}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-slip border-2 border-dashed border-ink bg-slip px-6 text-center transition-colors duration-150 active:bg-paper"
        >
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-slip border-2 border-ink bg-copper text-slip shadow-sign-sm">
            <Camera size={32} strokeWidth={2.25} aria-hidden />
          </span>
          <span className="text-title font-extrabold">Take a photo of the damaged leaf</span>
          <span className="text-label font-semibold text-ink-2">
            Close up, in daylight, one plant
          </span>
        </button>
      )}
    </div>
  )
}
