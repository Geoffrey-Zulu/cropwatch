import { useEffect, useState } from 'react'

// The current time, refreshed every interval: time windows ("last 14 days", "3 h ago") move
// on their own without reading the clock during render.
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
