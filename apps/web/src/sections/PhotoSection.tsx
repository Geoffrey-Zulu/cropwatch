import { getDownloadURL, ref } from 'firebase/storage'
import { ImageOff } from 'lucide-react'
import { simPhotoFor } from '@repo/shared'
import { useEffect, useState } from 'react'
import { Bar, Loading } from '../components/Skeleton'
import { storage } from '../lib/firebase'

// The report's photo. Command Center roles may read any report photo (infra/storage.rules).
// A simulated report shows a library photo of its issue, captioned as not from the farm, with
// its author and licence (SIM_PHOTOS); some simulated reports have no photo.
export function PhotoSection({ path, sim }: { path: string | null; sim: boolean }) {
  const library = path ? simPhotoFor(path) : null
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
      <figure>
        <img
          src={current.url}
          alt={library ? 'A library photo of the reported problem' : 'The reported crop'}
          className="aspect-[4/3] w-full rounded-card object-cover"
        />
        {library && (
          <figcaption className="mt-1 text-caption text-fg-2">
            Library photo, not from this farm ·{' '}
            <a
              href={library.page_url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-hairline-strong underline-offset-2"
            >
              {library.author}
            </a>
            , {library.licence}
          </figcaption>
        )}
      </figure>
    )
  if (path && !current)
    return (
      <Loading label="Loading the photo">
        <Bar className="aspect-[4/3] w-full rounded-card" />
      </Loading>
    )
  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-hairline-strong bg-ground text-center text-label text-fg-2">
      <ImageOff aria-hidden />
      {sim ? 'Simulated report: no photo' : !path ? 'No photo' : 'The photo could not be loaded'}
    </div>
  )
}
