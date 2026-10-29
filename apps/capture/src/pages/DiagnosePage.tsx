import type { User } from 'firebase/auth'
import { getStorage, ref, uploadBytes } from 'firebase/storage'
import { Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { findDistrict, type Crop } from '@repo/shared'
import { CameraCapture } from '../components/CameraCapture'
import { CropChips } from '../components/CropChips'
import { LocationRow, type GpsState } from '../components/LocationRow'
import { Notice } from '../components/Notice'
import { AppHeader } from '../components/AppHeader'
import { ActionBar } from '../components/ActionBar'
import type { Route } from '../hooks/useRoute'
import { createObservation } from '../lib/api'
import { app } from '../lib/firebase'
import { currentPosition, nearestDistrict, type Point } from '../lib/location'
import { resizeToJpeg } from '../lib/photo'
import { readHomeDistrict, saveHomeDistrict } from '../lib/homeDistrict'
import { buildReport, newObsId, photoPath } from '../lib/report'

type Sending = 'idle' | 'photo' | 'report'

const today = () => new Date().toISOString().slice(0, 10)

export function DiagnosePage({
  user,
  navigate,
}: {
  user: User
  navigate: (route: Route, options?: { replace?: boolean }) => void
}) {
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [crop, setCrop] = useState<Crop | null>(null)
  const [district, setDistrict] = useState(() => readHomeDistrict() ?? '')
  const [gps, setGps] = useState<GpsState>('searching')
  const [fix, setFix] = useState<Point | null>(null)
  const [plantingDate, setPlantingDate] = useState('')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState<Sending>('idle')
  const [error, setError] = useState<string | null>(null)
  // One report id per report: a retry re-sends the same id (the API treats it as the same
  // report) and never re-uploads a photo that already landed (Storage photos are create-only).
  const attempt = useRef<{ obsId: string; uploaded: boolean } | null>(null)
  const pickedByHand = useRef(false)

  useEffect(() => {
    let cancelled = false
    currentPosition()
      .then(point => {
        if (cancelled) return
        setFix(point)
        setGps('found')
        if (!pickedByHand.current) setDistrict(nearestDistrict(point).name)
      })
      .catch(() => !cancelled && setGps('unavailable'))
    return () => {
      cancelled = true
    }
  }, [])

  const ready = photo !== null && crop !== null && district !== '' && sending === 'idle'

  async function send() {
    if (!photo || !crop || !district) return
    setError(null)
    attempt.current ??= { obsId: newObsId(), uploaded: false }
    const { obsId } = attempt.current
    try {
      if (!attempt.current.uploaded) {
        setSending('photo')
        await uploadBytes(ref(getStorage(app), photoPath(user.uid, obsId)), photo, {
          contentType: 'image/jpeg',
        })
        attempt.current.uploaded = true
      }
      setSending('report')
      // Without a GPS fix, the district town stands in: the report is still placed in the
      // right district, which is what clusters and alerts use.
      const location = fix ?? findDistrict(district)!.center
      await createObservation(
        await user.getIdToken(),
        buildReport({
          obsId,
          uid: user.uid,
          crop,
          district,
          location,
          plantingDate: plantingDate || null,
          description,
        })
      )
      saveHomeDistrict(district)
      navigate({ page: 'sent', obsId }, { replace: true })
    } catch (e) {
      setSending('idle')
      setError(
        navigator.onLine
          ? `Your report did not go through (${(e as Error).message}). Your photo is kept; try again.`
          : 'No connection. Your photo is kept; send it again when you have signal.'
      )
    }
  }

  return (
    <>
      <AppHeader district={district || null} onReports={() => navigate({ page: 'home' })} />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 pt-5">
        <div>
          <p className="eyebrow">New report</p>
          <h1 className="mt-1 font-display text-display font-bold text-fg">
            What is wrong with your crop?
          </h1>
        </div>

        <CameraCapture
          photo={photo}
          onRetake={() => {
            setError(null)
            attempt.current = null
            setPhoto(null)
          }}
          onPhoto={file => {
            setError(null)
            attempt.current = null
            resizeToJpeg(file)
              .then(setPhoto)
              .catch(() => setError('That photo could not be read. Please take it again.'))
          }}
        />

        <CropChips value={crop} onChange={setCrop} />

        <LocationRow
          gps={gps}
          district={district}
          onDistrict={name => {
            pickedByHand.current = true
            setDistrict(name)
          }}
        />

        <div>
          <label htmlFor="planted" className="eyebrow mb-2 block">
            Planting date (if you know it)
          </label>
          <input
            id="planted"
            type="date"
            max={today()}
            value={plantingDate}
            onChange={event => setPlantingDate(event.target.value)}
            className="min-h-14 w-full rounded-card border-1.5 border-hairline-strong bg-panel px-3 font-mono text-data text-fg"
          />
        </div>

        <div>
          <label htmlFor="notes" className="eyebrow mb-2 block">
            What do you see? (optional)
          </label>
          <textarea
            id="notes"
            rows={3}
            maxLength={500}
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="Holes in the leaves, worms inside…"
            className="w-full rounded-card border-1.5 border-hairline-strong bg-panel p-3 font-body text-body text-fg placeholder:text-fg-2"
          />
        </div>

        {error && (
          <Notice
            action={
              <button type="button" onClick={send} className="btn-quiet w-full">
                Try again
              </button>
            }
          >
            {error}
          </Notice>
        )}
      </main>

      <ActionBar>
        <button type="button" className="btn-primary" disabled={!ready} onClick={send}>
          <Send size={22} strokeWidth={2} aria-hidden />
          {sending === 'photo'
            ? 'Sending photo…'
            : sending === 'report'
              ? 'Sending report…'
              : 'Send report'}
        </button>
        {!ready && sending === 'idle' && (
          <p className="mt-2 text-center text-label font-semibold text-fg-2">
            {!photo
              ? 'Take a photo first'
              : !crop
                ? 'Choose the crop'
                : !district
                  ? 'Choose your district'
                  : ''}
          </p>
        )}
      </ActionBar>
    </>
  )
}
