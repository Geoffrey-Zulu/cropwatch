import { z } from '../zod'
import { MomoProviderSchema, SatelliteStatusSchema } from '../constants/ceih'
import { ProvinceSchema } from '../constants/provinces'
import { DateSchema, GeoPointSchema, TimestampSchema } from './common'
import { CurvePointSchema, MsisdnSchema } from './ceih'

// CEIH REST additions to /api/v1 (docs/ceih-overnight-plan.md, Phase 2), additive to the frozen
// contract: request and response bodies the handlers parse and contracts/openapi.json documents.

export const CeihOrgQuerySchema = z.object({
  org_id: z.string().min(1).max(128).optional().openapi({
    description:
      "The agribusiness. Defaults to the caller's own org; a Command Center account must name it.",
  }),
})

export const CreateFarmerRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    phone_msisdn: MsisdnSchema,
    momo_provider: MomoProviderSchema,
    camp: z.string().trim().min(1).max(80),
    district: z.string().trim().min(1).max(80),
    province: ProvinceSchema,
    field_pin: GeoPointSchema,
    claimed_ha: z.number().positive().max(500),
    // The officer read the consent text to the farmer and they agreed.
    consent: z.literal(true),
  })
  .openapi('CreateFarmerRequest')

export const FarmerCreatedSchema = z.object({ farmer_id: z.string() }).openapi('FarmerCreated')

export const ImportResultSchema = z
  .object({
    contracts: z.number().int(),
    rejected: z.array(z.object({ line: z.number().int(), reason: z.string() })),
  })
  .openapi('ContractImportResult')

export const InputsRequestSchema = z
  .object({
    code: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
  })
  .openapi('InputsRequest', {
    description:
      'Without a code: send the farmer an SMS with the loan amount and a code. With the code the farmer reads out: record the handover and the loan.',
  })
export const InputsResultSchema = z
  .object({ state: z.enum(['code_sent', 'acknowledged']) })
  .openapi('InputsResult')

export const AdvanceRequestSchema = z
  .object({
    contract_id: z.string().min(1).max(128),
    amount_zmw: z.number().int().positive().optional(),
  })
  .openapi('AdvanceRequest', { description: 'amount_zmw defaults to the cap.' })
export const AdvanceRequestedSchema = z
  .object({ advance_id: z.string(), amount_zmw: z.number().int(), fee_zmw: z.number().int() })
  .openapi('AdvanceRequested')
export const AdvanceConfirmSchema = z
  .object({ code: z.string().regex(/^\d{6}$/) })
  .openapi('AdvanceConfirm')
export const DisbursementResultSchema = z
  .object({ tx_ref: z.string().nullable(), simulated: z.boolean() })
  .openapi('DisbursementResult')
export const OkSchema = z.object({ ok: z.literal(true) }).openapi('Ok')

export const SatelliteCurveSchema = z
  .object({
    contract_id: z.string(),
    status: SatelliteStatusSchema,
    source: z.enum(['seeded', 'earth_engine', 'stac']),
    curve: z.array(CurvePointSchema),
    sim: z.boolean(),
  })
  .openapi('SatelliteCurve')

export const SatelliteIngestRequestSchema = z
  .object({
    contract_id: z.string().min(1).max(128),
    source: z.enum(['earth_engine', 'stac']),
    passes: z
      .array(
        z.object({
          date: DateSchema,
          ndvi: z.number().min(-1).max(1).nullable(),
          ndvi_camp_median: z.number().min(-1).max(1).nullable(),
          cloud_pct: z.number().min(0).max(100),
        })
      )
      .min(1)
      .max(400),
  })
  .openapi('SatelliteIngestRequest')
export const IngestResultSchema = z
  .object({ contract_id: z.string(), passes: z.number().int() })
  .openapi('SatelliteIngestResult')

export const TriggerResultsSchema = z
  .array(z.object({ camp: z.string(), fired: z.boolean() }))
  .openapi('TriggerResults')

// Camp level only: no farmer rows, no locations (spec §6.7).
export const CampPortfolioSchema = z
  .object({
    org_id: z.string(),
    name: z.string(),
    season: z.string(),
    today: TimestampSchema,
    contracts: z.number().int(),
    projected_value_zmw: z.number().int(),
    input_loans_zmw: z.number().int(),
    advances_out_zmw: z.number().int(),
    recovered_zmw: z.number().int(),
    shock_camps: z.array(z.string()),
    verified: z.number().int(),
    eligible: z.number().int(),
    awaiting_approval: z.number().int(),
    camps: z.array(
      z.object({
        camp: z.string(),
        contracts: z.number().int(),
        verified: z.number().int(),
        eligible: z.number().int(),
        exposure_zmw: z.number().int(),
        shock: z.boolean(),
      })
    ),
    sim: z.boolean(),
  })
  .openapi('CampPortfolio')
