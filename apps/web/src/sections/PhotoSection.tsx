import { getDownloadURL, ref } from 'firebase/storage'
import { ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { storage } from '../lib/firebase'

// The report's photo. Command Center roles may read any report photo (infra/storage.rules).
// Simulated reports have no photo.
export function PhotoSection({ path, sim }: { path: string | null; sim: boolean }) {
  // Keyed by path, so a new report never shows the last one's photo while loading.
  const [result, setResult] = useState<{ path: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!path) return
    let live = true
    getDownloadURL(ref(storage, path))
      .then(url => live && setResult({ path, url }))
      .catch(() => live && setResult({ path, url: null }))
    return () => {
      live = false
    }
  }, [path])

  const current = result && result.path === path ? result : null
  if (current?.url)
    return (
      <img
        src={current.url}
        alt="The reported crop"
        className="aspect-[4/3] w-full rounded-card border border-hairline object-cover"
      />
    )
  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-hairline-strong bg-ground text-center text-label text-fg-2">
      <ImageOff size={24} strokeWidth={2} aria-hidden />
      {sim
        ? 'Simulated report: no photo'
        : !path
          ? 'No photo'
          : current
            ? 'The photo could not be loaded'
            : 'Loading the photo…'}
    </div>
  )
}
