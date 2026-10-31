import { useEffect, useRef, useState } from 'react'

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// A figure that counts to its new value when it changes (the motion spec: about 350 ms,
// ease-out, no bounce), and simply changes under prefers-reduced-motion. The first render
// shows the value at once: figures count on change, not on load, unless `start` is given (the
// season's portfolio counts up from it when the page opens).
export function useCountUp(value: number, duration = 350, start?: number) {
  const [shown, setShown] = useState(start ?? value)
  const from = useRef(start ?? value)
  useEffect(() => {
    const start = from.current
    from.current = value
    if (start === value || reduced()) {
      setShown(value)
      return
    }
    let frame = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(start + (value - start) * eased))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])
  return shown
}

// A number that counts up when it changes.
export function CountUp({
  value,
  format,
  start,
}: {
  value: number
  format?: (n: number) => string
  start?: number
}) {
  const shown = useCountUp(value, start === undefined ? 350 : 700, start)
  return <>{format ? format(shown) : shown}</>
}
