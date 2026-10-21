import { politeGet, type HostLimiter } from './http'

export interface Snapshot {
  timestamp: string
  // Original bytes, without the Wayback toolbar (the id_ modifier).
  rawUrl: string
  // The human-readable snapshot, recorded in the manifest.
  archiveUrl: string
}

// CDX rows: [urlkey, timestamp, original, mimetype, statuscode, digest, length]; the first row
// is the header. Picks the newest snapshot that returned 200.
export function newestSnapshot(cdxJson: unknown): Snapshot | null {
  if (!Array.isArray(cdxJson) || cdxJson.length < 2) return null
  const rows = (cdxJson.slice(1) as string[][]).filter(row => row[4] === '200')
  const newest = rows.sort((a, b) => a[1].localeCompare(b[1]))[rows.length - 1]
  if (!newest) return null
  const [, timestamp, original] = newest
  return snapshotAt(timestamp, original)
}

export const snapshotAt = (timestamp: string, url: string): Snapshot => ({
  timestamp,
  rawUrl: `https://web.archive.org/web/${timestamp}id_/${url}`,
  archiveUrl: `https://web.archive.org/web/${timestamp}/${url}`,
})

// "https://web.archive.org/web/20240101000000/https://…" → its parts, for a curated hint.
export function parseArchiveUrl(archiveUrl: string): Snapshot | null {
  const match = /^https?:\/\/web\.archive\.org\/web\/(\d{4,14})(?:id_)?\/(.+)$/.exec(archiveUrl)
  return match ? snapshotAt(match[1], match[2]) : null
}

// The newest good snapshot: the CDX index first, else Wayback's own redirect from
// /web/2026/<url> to the snapshot nearest today.
export async function findSnapshot(url: string, limiter: HostLimiter): Promise<Snapshot | null> {
  const cdx = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&filter=statuscode:200&limit=-5`
  try {
    const response = await politeGet(cdx, limiter, { attempts: 2 })
    const found = newestSnapshot(JSON.parse(response.body.toString('utf8') || '[]'))
    if (found) return found
  } catch {
    // Fall through to the redirect lookup.
  }
  try {
    const response = await politeGet(`https://web.archive.org/web/2026/${url}`, limiter, {
      attempts: 2,
    })
    return parseArchiveUrl(response.finalUrl)
  } catch {
    return null
  }
}
