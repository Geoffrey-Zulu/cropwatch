import type { Diagnose, DiagnoseOutcome } from './firestoreDiagnoser'
import type { Recommend, RecommendOutcome } from './firestoreRecommender'

export interface ProcessOutcome {
  diagnosis: DiagnoseOutcome
  recommendation: RecommendOutcome
}

export type ProcessObservation = (obsId: string) => Promise<ProcessOutcome>

// Photo → diagnosis → recommendation. Each step acts only in its own status (diagnosing,
// recommending) and is idempotent, so any trigger may run the whole pipeline: a report, a
// photo upload event, a verify, or a retry of any of them.
export function pipeline(diagnose: Diagnose, recommend: Recommend): ProcessObservation {
  return async obsId => {
    const diagnosis = await diagnose(obsId)
    const recommendation = await recommend(obsId)
    return { diagnosis, recommendation }
  }
}
