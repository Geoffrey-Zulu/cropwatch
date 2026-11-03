import type { Firestore } from 'firebase-admin/firestore'
import { fromFirestore } from '../../lib/firestoreData'
import { errorFields, log } from '../../lib/log'
import { observationLinker } from './season'

// The geofence link for new reports (spec W2.4), on Firestore. Active contracts are cached for a
// minute: a report needs only their crop and polygon, never a farmer's name or number.
export function firestoreLinker(db: Firestore) {
  let cache: { at: number; value: Awaited<ReturnType<typeof loadContracts>> } | null = null

  async function loadContracts() {
    const snap = await db.collection('contracts').where('status', '==', 'active').get()
    const orgs = [...new Set(snap.docs.map(d => d.get('org_id') as string))]
    const states = orgs.length
      ? await db.getAll(...orgs.map(org => db.collection('ceih_demo').doc(org)))
      : []
    const offsets = new Map(
      states.map(s => [s.id, (s.get('offset_days') as number | undefined) ?? 0])
    )
    return {
      contracts: snap.docs.map(d => ({
        id: d.id,
        farmer_id: d.get('farmer_id') as string,
        crop: d.get('crop') as string,
        polygon: d.get('field_polygon') as string,
        offset_days: offsets.get(d.get('org_id') as string) ?? 0,
      })),
    }
  }

  const link = observationLinker({
    async load() {
      if (!cache || Date.now() - cache.at > 60_000)
        cache = { at: Date.now(), value: await loadContracts() }
      return cache.value
    },
    async get(obsId) {
      const snap = await db.collection('observations').doc(obsId).get()
      return snap.exists ? (fromFirestore(snap.data()) as never) : null
    },
    async patch(obsId, fields) {
      await db.collection('observations').doc(obsId).update(fields)
    },
  })

  return async (obsId: string) => {
    try {
      const farmerId = await link(obsId)
      if (farmerId) log('INFO', 'ceih: report linked to a farmer record', { obs_id: obsId })
    } catch (error) {
      log('WARNING', 'ceih: report link failed', { obs_id: obsId, ...errorFields(error) })
    }
  }
}
