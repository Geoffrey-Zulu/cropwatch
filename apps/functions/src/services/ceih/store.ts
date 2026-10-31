import type { Firestore } from 'firebase-admin/firestore'
import {
  AdvanceSchema,
  CeihDemoStateSchema,
  ContractSchema,
  CreditConfigSchema,
  DeliverySchema,
  FarmerSchema,
  LedgerEntrySchema,
  ObservationSchema,
  RainfallSeriesSchema,
  RoleSchema,
  SatelliteMetricsSchema,
  SmsLogSchema,
  WeatherTriggerSchema,
  ADVANCE_FEE_PCT,
  CAP_PCT_DEFAULT,
  HARD_CEILING_ZMW,
  type Advance,
  type AdvanceState,
  type CeihDemoState,
  type Contract,
  type Delivery,
  type LedgerEntry,
  type Observation,
  type ShockFlag,
  type SmsLog,
  type WeatherTrigger,
} from '@repo/shared'
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'
import type { ZodTypeAny, z } from 'zod'
import { fromFirestore, toGeoPoint, toTimestamp } from '../../lib/firestoreData'
import { log } from '../../lib/log'
import type { SeasonData } from './views'

// CEIH persistence (docs/ceih-workflows-mvp.md §3.1). The collections are server-only
// (infra/firestore.rules matches none of them); times are ISO strings. Every write that moves an
// advance on checks its state inside a transaction, so two clicks can never send money twice.
export interface SeasonStore {
  load(orgId: string): Promise<SeasonData | null>
  // Writes `next` only if the advance is still in `from` (null: it must not exist yet), together
  // with its ledger rows. False when someone else moved it first.
  commitAdvance(
    id: string,
    from: AdvanceState | null,
    next: Advance,
    ledger: LedgerEntry[]
  ): Promise<boolean>
  newId(collection: 'advances' | 'deliveries' | 'weather_triggers' | 'observations'): string
  addDelivery(
    id: string,
    delivery: Delivery,
    ledger: LedgerEntry[],
    sideSell: boolean
  ): Promise<void>
  logSms(entry: SmsLog): Promise<void>
  setState(orgId: string, patch: Partial<CeihDemoState>): Promise<void>
  writeTrigger(
    id: string,
    trigger: WeatherTrigger,
    flag: { contractIds: string[]; flag: ShockFlag } | null
  ): Promise<void>
  addObservation(id: string, observation: Observation): Promise<void>
  patchObservation(id: string, patch: Partial<Observation>): Promise<void>
}

function parseAll<S extends ZodTypeAny>(
  schema: S,
  docs: QueryDocumentSnapshot[],
  what: string
): { id: string; data: z.infer<S> }[] {
  return docs.flatMap(doc => {
    const parsed = schema.safeParse(fromFirestore(doc.data()))
    if (parsed.success) return [{ id: doc.id, data: parsed.data }]
    log('WARNING', 'ceih: unreadable document skipped', {
      what,
      id: doc.id,
      issue: parsed.error.issues[0]?.message,
    })
    return []
  })
}

export function firestoreSeasonStore(db: Firestore): SeasonStore {
  const byOrg = (collection: string, orgId: string) =>
    db.collection(collection).where('org_id', '==', orgId).get()

  return {
    async load(orgId) {
      const [
        orgSnap,
        stateSnap,
        farmers,
        contracts,
        metrics,
        advances,
        ledger,
        deliveries,
        triggers,
        rainfall,
        sms,
      ] = await Promise.all([
        db.collection('orgs').doc(orgId).get(),
        db.collection('ceih_demo').doc(orgId).get(),
        byOrg('farmers', orgId),
        byOrg('contracts', orgId),
        byOrg('satellite_metrics', orgId),
        byOrg('advances', orgId),
        byOrg('ledger_entries', orgId),
        byOrg('deliveries', orgId),
        byOrg('weather_triggers', orgId),
        byOrg('rainfall_series', orgId),
        byOrg('sms_log', orgId),
      ])
      if (!orgSnap.exists || farmers.empty) return null
      const org = orgSnap.data()!
      const credit = CreditConfigSchema.safeParse(org.credit)
      // No demo calendar: the real calendar (production).
      const state = stateSnap.exists
        ? CeihDemoStateSchema.parse(fromFirestore(stateSnap.data()))
        : {
            phase: 'january' as const,
            offset_days: 0,
            sms_allow: [],
            hero_farmer_id: null,
            neighbour_farmer_id: null,
            ground_officer_id: null,
            armed_at: new Date(0).toISOString(),
            sim: false,
          }
      const farmerRows = parseAll(FarmerSchema, farmers.docs, 'farmer')
      const farmerIds = new Set(farmerRows.map(f => f.id))

      // Reports on these farmers' fields (the geofence link), with the internal severity.
      const linked = await db.collection('observations').where('farmer_id', '!=', null).get()
      const observations = parseAll(
        ObservationSchema,
        linked.docs.filter(d => farmerIds.has(d.get('farmer_id'))),
        'observation'
      )
      const internals = observations.length
        ? await db.getAll(
            ...observations.map(o =>
              db.collection('observations').doc(o.id).collection('internal').doc('diagnosis')
            )
          )
        : []
      const severity = new Map(
        internals.map(s => [
          s.ref.parent.parent!.id,
          (s.data()?.severity_pct as number | null | undefined) ?? null,
        ])
      )

      const advanceRows = parseAll(AdvanceSchema, advances.docs, 'advance')
      const uids = new Set<string>()
      for (const f of farmerRows) if (f.data.consent) uids.add(f.data.consent.officer_id)
      for (const o of observations) if (o.data.verified_by) uids.add(o.data.verified_by)
      for (const a of advanceRows) {
        a.data.eligibility_snapshot.verifier_ids.forEach(uid => uids.add(uid))
        if (a.data.approval) uids.add(a.data.approval.approver_id)
      }
      const userSnaps = uids.size
        ? await db.getAll(...[...uids].map(uid => db.collection('users').doc(uid)))
        : []
      const users = new Map(
        userSnaps
          .filter(s => s.exists)
          .map(s => {
            const role = RoleSchema.safeParse(s.get('role'))
            return [
              s.id,
              {
                role: role.success ? role.data : ('farmer' as const),
                display_name:
                  typeof s.get('display_name') === 'string'
                    ? (s.get('display_name') as string)
                    : null,
              },
            ] as const
          })
      )

      return {
        org: {
          id: orgId,
          name: typeof org.name === 'string' ? org.name : orgId,
          credit: credit.success
            ? credit.data
            : {
                cap_pct: CAP_PCT_DEFAULT,
                hard_ceiling_zmw: HARD_CEILING_ZMW,
                advance_fee_pct: ADVANCE_FEE_PCT,
              },
          sim: org.sim === true,
        },
        state,
        farmers: farmerRows,
        contracts: parseAll(ContractSchema, contracts.docs, 'contract'),
        metrics: parseAll(SatelliteMetricsSchema, metrics.docs, 'satellite_metrics'),
        advances: advanceRows,
        ledger: parseAll(LedgerEntrySchema, ledger.docs, 'ledger_entry'),
        deliveries: parseAll(DeliverySchema, deliveries.docs, 'delivery'),
        triggers: parseAll(WeatherTriggerSchema, triggers.docs, 'weather_trigger'),
        rainfall: parseAll(RainfallSeriesSchema, rainfall.docs, 'rainfall_series'),
        sms: parseAll(SmsLogSchema, sms.docs, 'sms_log'),
        observations: observations.map(o => ({ ...o, severity_pct: severity.get(o.id) ?? null })),
        users,
      }
    },

    async commitAdvance(id, from, next, ledger) {
      const ref = db.collection('advances').doc(id)
      return db.runTransaction(async tx => {
        const snap = await tx.get(ref)
        const current = snap.exists ? (snap.get('state') as AdvanceState) : null
        if (current !== from) return false
        tx.set(ref, AdvanceSchema.parse(next))
        for (const row of ledger)
          tx.set(db.collection('ledger_entries').doc(), LedgerEntrySchema.parse(row))
        return true
      })
    },

    newId(collection) {
      return db.collection(collection).doc().id
    },

    async addDelivery(id, delivery, ledger, sideSell) {
      const batch = db.batch()
      batch.set(db.collection('deliveries').doc(id), DeliverySchema.parse(delivery))
      for (const row of ledger)
        batch.set(db.collection('ledger_entries').doc(), LedgerEntrySchema.parse(row))
      batch.update(db.collection('contracts').doc(delivery.contract_id), {
        side_sell_suspected: sideSell,
      } satisfies Partial<Contract>)
      await batch.commit()
    },

    async logSms(entry) {
      await db.collection('sms_log').add(SmsLogSchema.parse(entry))
    },

    async setState(orgId, patch) {
      await db.collection('ceih_demo').doc(orgId).set(patch, { merge: true })
    },

    async writeTrigger(id, trigger, flag) {
      const batch = db.batch()
      batch.set(db.collection('weather_triggers').doc(id), WeatherTriggerSchema.parse(trigger))
      if (flag)
        for (const contractId of flag.contractIds)
          batch.update(db.collection('contracts').doc(contractId), { shock_flag: flag.flag })
      await batch.commit()
    },

    async addObservation(id, observation) {
      const o = ObservationSchema.parse(observation)
      await db
        .collection('observations')
        .doc(id)
        .create({
          ...o,
          created_at: toTimestamp(o.created_at),
          location: toGeoPoint(o.location),
          diagnosis: o.diagnosis && {
            ...o.diagnosis,
            diagnosed_at: toTimestamp(o.diagnosis.diagnosed_at),
          },
        })
    },

    async patchObservation(id, patch) {
      await db.collection('observations').doc(id).update(patch)
    },
  }
}
