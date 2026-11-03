import { createHash, randomInt } from 'node:crypto'
import type { Firestore } from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  CEIH_SEASON,
  circlePolygon,
  COMMAND_CENTER_ROLES,
  ContractSchema,
  CreateFarmerRequestSchema,
  CropSchema,
  DateSchema,
  deriveStatuses,
  FarmerSchema,
  fieldRadiusM,
  LedgerEntrySchema,
  MomoProviderSchema,
  MsisdnSchema,
  OTP_LENGTH,
  OTP_TTL_MINUTES,
  ProvinceSchema,
  SATELLITE_COLLECTION,
  SatelliteIngestRequestSchema,
  SatelliteMetricsSchema,
  zmw,
  type Contract,
} from '@repo/shared'
import type { SmsSender } from '../alerts/sms'
import type { Caller } from '../observationModel'
import { SeasonError } from './season'

// Enrolment and the satellite feed (spec W0, W1, §3.6): a farmer with consent and a field pin, a
// roster of contracts from CSV, the input handover acknowledged with the farmer's code, and a
// pass list from a live Sentinel-2 pull. Not on the demo path: the seed builds the demo season.

export interface EnrolService {
  createFarmer(caller: Caller, orgId: string, body: unknown): Promise<{ farmer_id: string }>
  importContracts(
    caller: Caller,
    orgId: string,
    csv: string
  ): Promise<{ contracts: number; rejected: { line: number; reason: string }[] }>
  recordInputs(
    caller: Caller,
    orgId: string,
    contractId: string,
    code?: string
  ): Promise<{ state: 'code_sent' | 'acknowledged' }>
  ingestPasses(
    caller: Caller,
    orgId: string,
    body: unknown
  ): Promise<{ contract_id: string; passes: number }>
}

const officerOf = (caller: Caller, orgId: string) =>
  COMMAND_CENTER_ROLES.includes(caller.role) ||
  ((caller.role === 'field_officer' || caller.role === 'credit') && caller.orgId === orgId)

const RosterRowSchema = z.object({
  farmer_name: z.string().trim().min(1).max(80),
  phone_msisdn: MsisdnSchema,
  momo_provider: MomoProviderSchema,
  camp: z.string().trim().min(1),
  district: z.string().trim().min(1),
  province: ProvinceSchema,
  latitude: z.coerce.number().min(-18.1).max(-8.2),
  longitude: z.coerce.number().min(21.9).max(33.75),
  crop: CropSchema,
  contracted_ha: z.coerce.number().positive().max(500),
  projected_yield_t_ha: z.coerce.number().positive().max(20),
  contract_price_zmw_t: z.coerce.number().int().positive(),
  input_loan_zmw: z.coerce.number().int().min(0),
  planting_date: DateSchema,
})

// Below this cloud share over the field a pass counts as clear. PLACEHOLDER.
const USABLE_CLOUD_PCT = 30

export function firestoreEnrol(
  db: Firestore,
  sms: SmsSender,
  now = () => new Date()
): EnrolService {
  return {
    async createFarmer(caller, orgId, body) {
      if (!officerOf(caller, orgId))
        throw new SeasonError('forbidden', 'Field officers of this organisation only.')
      const input = CreateFarmerRequestSchema.parse(body)
      const ref = db.collection('farmers').doc()
      await ref.create(
        FarmerSchema.parse({
          ...input,
          momo_verified: false,
          org_id: orgId,
          consent: { given_at: now().toISOString(), scope: 'org_contract', officer_id: caller.uid },
          field_polygon: null,
          history: { seasons: 0, defaults: 0, last_recovery_pct: null },
          sim: false,
        })
      )
      return { farmer_id: ref.id }
    },

    async importContracts(caller, orgId, csv) {
      if (!officerOf(caller, orgId) || caller.role === 'field_officer')
        throw new SeasonError('forbidden', 'The credit team imports the roster.')
      const [header, ...lines] = csv.trim().split(/\r?\n/)
      const columns = header.split(',').map(c => c.trim())
      const rejected: { line: number; reason: string }[] = []
      const batch = db.batch()
      let contracts = 0
      lines.forEach((line, i) => {
        const cells = line.split(',').map(c => c.trim())
        const row = RosterRowSchema.safeParse(
          Object.fromEntries(columns.map((c, k) => [c, cells[k]]))
        )
        if (!row.success) {
          rejected.push({
            line: i + 2,
            reason: row.error.issues.map(x => `${x.path.join('.')}: ${x.message}`).join('; '),
          })
          return
        }
        const r = row.data
        const farmer = db.collection('farmers').doc()
        const contract = db.collection('contracts').doc()
        const pin = { latitude: r.latitude, longitude: r.longitude }
        batch.set(
          farmer,
          FarmerSchema.parse({
            name: r.farmer_name,
            phone_msisdn: r.phone_msisdn,
            momo_provider: r.momo_provider,
            momo_verified: false,
            org_id: orgId,
            camp: r.camp,
            district: r.district,
            province: r.province,
            // Consent is recorded by the officer at the first visit, not by an import.
            consent: null,
            field_pin: pin,
            field_polygon: null,
            claimed_ha: r.contracted_ha,
            history: { seasons: 0, defaults: 0, last_recovery_pct: null },
            sim: false,
          })
        )
        batch.set(
          contract,
          ContractSchema.parse({
            farmer_id: farmer.id,
            org_id: orgId,
            season: CEIH_SEASON,
            crop: r.crop,
            camp: r.camp,
            district: r.district,
            planting_date: r.planting_date,
            contracted_ha: r.contracted_ha,
            projected_yield_t_ha: r.projected_yield_t_ha,
            contract_price_zmw_t: r.contract_price_zmw_t,
            projected_value_zmw: Math.round(
              r.contracted_ha * r.projected_yield_t_ha * r.contract_price_zmw_t
            ),
            input_loan_zmw: r.input_loan_zmw,
            inputs_delivered: null,
            field_polygon: circlePolygon(pin, fieldRadiusM(r.contracted_ha)),
            status: 'active',
            shock_flag: null,
            side_sell_suspected: false,
            sim: false,
          } satisfies Contract)
        )
        contracts++
      })
      if (contracts > 450)
        throw new SeasonError('refused', 'Import at most 450 contracts at a time.')
      await batch.commit()
      return { contracts, rejected }
    },

    // Two calls: the first sends the farmer a code with the loan amount; the second, with the code
    // the farmer reads out, records the handover and the loan's ledger row.
    async recordInputs(caller, orgId, contractId, code) {
      if (!officerOf(caller, orgId))
        throw new SeasonError('forbidden', 'Field officers of this organisation only.')
      const ref = db.collection('contracts').doc(contractId)
      const pending = ref.collection('internal').doc('inputs_otp')
      const snap = await ref.get()
      if (!snap.exists || snap.get('org_id') !== orgId)
        throw new SeasonError('not_found', 'No such contract.')
      const contract = ContractSchema.parse(snap.data())
      if (contract.inputs_delivered)
        throw new SeasonError('refused', 'The inputs are already acknowledged.')
      const farmer = FarmerSchema.parse(
        (await db.collection('farmers').doc(contract.farmer_id).get()).data()
      )
      const hash = (value: string) => createHash('sha256').update(value).digest('hex')
      if (!code) {
        const fresh = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0')
        await pending.set({
          sha256: hash(fresh),
          expires_at: new Date(now().getTime() + OTP_TTL_MINUTES * 60_000).toISOString(),
        })
        await sms
          .send(
            [farmer.phone_msisdn],
            `Phytos: inputs worth ${zmw(contract.input_loan_zmw)} on loan from your contract, repaid at harvest. If you received them, give your officer this code: ${fresh}.`
          )
          .catch(() => [])
        return { state: 'code_sent' }
      }
      const otp = (await pending.get()).data()
      if (
        !otp ||
        otp.sha256 !== hash(code) ||
        Date.parse(otp.expires_at as string) < now().getTime()
      )
        throw new SeasonError('refused', 'That code does not match, or it has expired.')
      const at = now().toISOString()
      const batch = db.batch()
      batch.update(ref, { inputs_delivered: { at, photo_path: null, otp_confirmed: true } })
      batch.set(
        db.collection('ledger_entries').doc(),
        LedgerEntrySchema.parse({
          contract_id: contractId,
          farmer_id: contract.farmer_id,
          org_id: orgId,
          at,
          type: 'input_loan',
          amount_zmw: contract.input_loan_zmw,
          ref: `INP-${contractId}`,
          note: "Input package, acknowledged with the farmer's SMS code",
          simulated: false,
          sim: contract.sim,
        })
      )
      batch.delete(pending)
      await batch.commit()
      return { state: 'acknowledged' }
    },

    async ingestPasses(caller, orgId, body) {
      if (!COMMAND_CENTER_ROLES.includes(caller.role))
        throw new SeasonError('forbidden', 'The satellite feed is internal.')
      const input = SatelliteIngestRequestSchema.parse(body)
      const snap = await db.collection('contracts').doc(input.contract_id).get()
      if (!snap.exists || snap.get('org_id') !== orgId)
        throw new SeasonError('not_found', 'No such contract.')
      const contract = ContractSchema.parse(snap.data())
      const computed_at = now().toISOString()
      const passes = deriveStatuses(
        input.passes.map(p => ({
          ...p,
          usable: p.ndvi !== null && p.cloud_pct < USABLE_CLOUD_PCT,
          collection: SATELLITE_COLLECTION,
          computed_at,
          status_derived: 'no_data' as const,
          sim: false,
        })),
        contract.planting_date,
        contract.crop
      )
      await db
        .collection('satellite_metrics')
        .doc(input.contract_id)
        .set(
          SatelliteMetricsSchema.parse({
            contract_id: input.contract_id,
            org_id: orgId,
            camp: contract.camp,
            source: input.source,
            passes,
            sim: false,
          })
        )
      return { contract_id: input.contract_id, passes: passes.length }
    },
  }
}
