import { Camera, Images, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type CameraState = 'starting' | 'live' | 'unavailable'

const cameraSupported = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

// The app opens on the camera: a live rear-camera viewfinder (getUserMedia needs no tap to
// start, unlike the file picker). Where there is no camera access, or it is refused, the file
// input takes over: `capture` opens the camera app on Android and the gallery elsewhere.
export function CameraCapture({
  photo,
  onPhoto,
  onRetake,
}: {
  photo: Blob | null
  onPhoto: (file: File) => void
  onRetake: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const fallback = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<CameraState>(() =>
    cameraSupported() ? 'starting' : 'unavailable'
  )
  const unavailable = state === 'unavailable'
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  // Release the previous photo's memory when it is replaced or the view goes away.
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview])

  // The stream runs only while there is no photo, and stops when the screen goes away.
  useEffect(() => {
    if (photo || unavailable) return
    let stream: MediaStream | null = null
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
        audio: false,
      })
      .then(live => {
        if (cancelled) return live.getTracks().forEach(track => track.stop())
        stream = live
        if (video.current) {
          video.current.srcObject = live
          void video.current.play().catch(() => undefined)
        }
        setState('live')
      })
      .catch(() => !cancelled && setState('unavailable'))
    return () => {
      cancelled = true
      stream?.getTracks().forEach(track => track.stop())
    }
  }, [photo, unavailable])

  function shoot() {
    const frame = video.current
    if (!frame || !frame.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = frame.videoWidth
    canvas.height = frame.videoHeight
    canvas.getContext('2d')?.drawImage(frame, 0, 0)
    canvas.toBlob(
      blob => blob && onPhoto(new File([blob], 'camera.jpg', { type: 'image/jpeg' })),
      'image/jpeg',
      0.92
    )
  }

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onPhoto(file)
    event.target.value = ''
  }

  return (
    <div>
      <input
        ref={fallback}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Photo of the damaged crop"
        onChange={pick}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose a photo from the gallery"
        onChange={pick}
      />

      {preview ? (
        <div className="relative overflow-hidden rounded-card bg-fg">
          <img src={preview} alt="Your photo" className="aspect-[4/3] w-full object-cover" />
          <button type="button" onClick={onRetake} className="btn-quiet absolute bottom-3 right-3">
            <RotateCcw size={20} strokeWidth={2} aria-hidden />
            Retake
          </button>
        </div>
      ) : unavailable ? (
        <button
          type="button"
          onClick={() => fallback.current?.click()}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-card border-1.5 border-dashed border-hairline-strong bg-panel px-6 text-center transition-colors duration-150 active:bg-well"
        >
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-signal text-signal-ink">
            <Camera size={30} strokeWidth={2} aria-hidden />
          </span>
          <span className="font-display text-title font-bold text-fg">
            Take a photo of the damaged leaf
          </span>
          <span className="text-label font-semibold text-fg-2">
            Close up, in daylight, one plant
          </span>
        </button>
      ) : (
        <div className="relative overflow-hidden rounded-card bg-fg">
          <video
            ref={video}
            muted
            playsInline
            autoPlay
            aria-label="Camera view"
            className="aspect-[4/3] w-full object-cover"
          />
          {state === 'starting' && (
            <p className="absolute inset-0 flex items-center justify-center text-label font-semibold text-white">
              Starting the camera…
            </p>
          )}
          <p className="absolute inset-x-0 top-0 bg-[rgb(14_22_19/0.72)] px-3 py-2 text-center text-label font-semibold text-white">
            Damaged leaf, close up, in daylight
          </p>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 pb-3">
            <button
              type="button"
              onClick={() => gallery.current?.click()}
              className="inline-flex min-h-12 items-center gap-1.5 rounded-card bg-[rgb(14_22_19/0.8)] px-3 text-label font-semibold text-white"
            >
              <Images size={20} strokeWidth={2} aria-hidden />
              Gallery
            </button>
            <button
              type="button"
              onClick={shoot}
              disabled={state !== 'live'}
              aria-label="Take photo"
              className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white bg-signal text-signal-ink disabled:opacity-60"
            >
              <Camera size={30} strokeWidth={2} aria-hidden />
            </button>
            {/* Balances the gallery button so the shutter stays centred. */}
            <span aria-hidden className="w-[92px]" />
          </div>
        </div>
      )}
    </div>
  )
}
