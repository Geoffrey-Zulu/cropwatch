import { errorFields, log } from '../lib/log'
import type { Diagnose, DiagnoseOutcome } from './firestoreDiagnoser'
import type { Recommend, RecommendOutcome } from './firestoreRecommender'
import type { Track, TrackOutcome } from './outbreaks/track'

export interface ProcessOutcome {
  diagnosis: DiagnoseOutcome
  recommendation: RecommendOutcome
  // Null when the outbreak step failed (logged); it never holds up the farmer's result.
  outbreaks?: TrackOutcome | null
}

export type ProcessObservation = (obsId: string) => Promise<ProcessOutcome>

// Photo → diagnosis → (recommendation ∥ outbreak tracking). Each step acts only in its own
// status and is idempotent, so any trigger may run the whole pipeline: a report, a photo upload
// event, a verify, or a retry of any of them. Tracking runs beside the recommendation so an alert
// does not wait for advice to be written.
export function pipeline(
  diagnose: Diagnose,
  recommend: Recommend,
  track?: Track
): ProcessObservation {
  return async obsId => {
    const diagnosis = await diagnose(obsId)
    const tracked = track
      ? track(obsId).catch(error => {
          log('ERROR', 'outbreak tracking failed', { obs_id: obsId, ...errorFields(error) })
          return null
        })
      : Promise.resolve(undefined)
    const [recommendation, outbreaks] = await Promise.all([recommend(obsId), tracked])
    return { diagnosis, recommendation, ...(outbreaks !== undefined && { outbreaks }) }
  }
}
