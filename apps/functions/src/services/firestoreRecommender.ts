import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import {
  RegisteredProductSchema,
  type Issue,
  type Observation,
  type RegisteredProduct,
} from '@repo/shared'
import { fromFirestore, toTimestamp } from '../lib/firestoreData'
import { log } from '../lib/log'
import { recommend } from './recommend/ipmLadder'
import type { KnowledgeLayer, KnowledgeResult } from './recommend/knowledge'

export type RecommendOutcome =
  | 'complete'
  // No cited evidence (or nothing to recommend for): routed to an officer instead.
  | 'referred'
  | 'missing'
  | 'not_recommending'
  | 'in_progress'

export type Recommend = (obsId: string) => Promise<RecommendOutcome>

const LEASE_MS = 120_000
const PRODUCTS_TTL_MS = 5 * 60_000

// The register changes rarely; re-read every few minutes rather than per observation.
export function registeredProducts(db: Firestore, now: () => number = Date.now) {
  let cached: { products: RegisteredProduct[]; at: number } | null = null
  return async () => {
    if (cached && now() - cached.at < PRODUCTS_TTL_MS) return cached.products
    const snap = await db.collection('registered_products').get()
    // Fail closed per row: a row this build cannot read (e.g. a newer source) is left out, never
    // guessed at, and never takes the whole register down with it.
    const products = snap.docs.flatMap(doc => {
      const parsed = RegisteredProductSchema.safeParse(fromFirestore(doc.data()))
      if (parsed.success) return [parsed.data]
      console.warn(`registered_products/${doc.id} skipped: ${parsed.error.issues[0]?.message}`)
      return []
    })
    cached = { products, at: now() }
    return products
  }
}

const effectiveIssue = (observation: Observation): Issue =>
  observation.verified_issue ?? observation.diagnosis?.suspected_issue ?? 'unknown'

// Runs once an observation is recommending (after diagnosis, or after a verify): knowledge →
// regulatory filter → IPM ladder, then complete with a recommendation, or back to the officer
// queue when nothing can be cited. Idempotent, with a lease like diagnosis. If a verify changes
// the issue while this runs, the result is discarded and the run repeats for the new issue.
export function firestoreRecommender({
  db,
  knowledge,
  products,
  allowPlaceholders = false,
}: {
  db: Firestore
  knowledge: KnowledgeLayer
  products: () => Promise<RegisteredProduct[]>
  allowPlaceholders?: boolean
}): Recommend {
  const run = async (obsId: string, attempt: number): Promise<RecommendOutcome> => {
    const ref = db.collection('observations').doc(obsId)
    const internal = ref.collection('internal')
    const lease = internal.doc('recommendation_lock')

    const claim = await db.runTransaction(async tx => {
      const [snap, lock] = await tx.getAll(ref, lease)
      if (!snap.exists) return 'missing' as const
      if (snap.get('status') !== 'recommending') return 'not_recommending' as const
      const claimedAt = lock.exists ? (lock.get('claimed_at') as Timestamp) : null
      if (claimedAt && Date.now() - claimedAt.toMillis() < LEASE_MS) return 'in_progress' as const
      tx.set(lease, { claimed_at: Timestamp.now() })
      return 'claimed' as const
    })
    if (claim !== 'claimed') return claim

    try {
      const started = Date.now()
      const observation = fromFirestore((await ref.get()).data()) as Observation
      const issue = effectiveIssue(observation)
      // Keep what the knowledge layer returned, for the internal record (per run, so
      // concurrent observations never share it).
      let retrieved: KnowledgeResult | null = null
      const traced: KnowledgeLayer = {
        retrieve: async query => (retrieved = await knowledge.retrieve(query)),
      }
      const now = new Date().toISOString()
      const outcome = await recommend(
        { knowledge: traced, products: await products(), allowPlaceholders },
        { obsId, observation, now }
      )

      const written = await db.runTransaction(async tx => {
        const current = await tx.get(ref)
        const latest = fromFirestore(current.data()) as Observation
        if (latest.status !== 'recommending' || effectiveIssue(latest) !== issue) {
          tx.delete(lease)
          return null
        }
        let recommendationId: string | null = null
        if (outcome.kind === 'recommendation') {
          const recRef = db.collection('recommendations').doc()
          recommendationId = recRef.id
          tx.set(recRef, {
            ...outcome.recommendation,
            created_at: toTimestamp(outcome.recommendation.created_at),
          })
          tx.update(ref, { recommendation_id: recRef.id, status: 'complete' })
        } else {
          tx.update(ref, { recommendation_id: null, status: 'awaiting_expert_review' })
        }
        tx.set(internal.doc('recommendation'), {
          issue,
          outcome: outcome.kind,
          recommendation_id: recommendationId,
          rejected_products:
            outcome.kind === 'recommendation'
              ? outcome.rejected.map(r => ({ candidate: r.candidate, reason: r.reason }))
              : [],
          trace: (retrieved as KnowledgeResult | null)?.trace ?? null,
          total_ms: Date.now() - started,
          created_at: toTimestamp(now),
        })
        tx.delete(lease)
        return outcome.kind
      })

      if (written === null) {
        // Superseded by a verify; one more pass picks up the new issue.
        return attempt < 2 ? run(obsId, attempt + 1) : 'not_recommending'
      }
      log('INFO', 'recommended', {
        obs_id: obsId,
        issue,
        outcome: written,
        total_ms: Date.now() - started,
      })
      return written === 'recommendation' ? 'complete' : 'referred'
    } catch (error) {
      await lease.delete().catch(() => {})
      throw error
    }
  }
  return obsId => run(obsId, 1)
}
