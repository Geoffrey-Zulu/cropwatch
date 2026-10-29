import { useEffect, useState } from 'react'

// Alerts this browser has opened, so the bell counts only the new ones (patterns-v2.md
// decision 7). Per viewer and best effort: storage can be missing (private windows), and then
// every alert counts as unseen.
const KEY = 'phytos.seenAlerts'
const EVENT = 'phytos-seen-alerts'

function read(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function markAlertSeen(id: string) {
  const seen = read()
  if (seen.has(id)) return
  seen.add(id)
  try {
    localStorage.setItem(KEY, JSON.stringify([...seen].slice(-500)))
  } catch {
    // Storage unavailable: the bell keeps counting it; nothing else depends on this.
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useSeenAlerts() {
  const [seen, setSeen] = useState(read)
  useEffect(() => {
    const update = () => setSeen(read())
    window.addEventListener(EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])
  return seen
}
