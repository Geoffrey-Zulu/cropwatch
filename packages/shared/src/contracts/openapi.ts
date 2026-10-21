// Builds the /api/v1 OpenAPI document from the Zod schemas. The output is committed as
// openapi.json, the file the Flutter app codes against. Regenerate with
// `pnpm --filter @repo/shared generate:openapi` after any additive change.
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  type ZodRequestBody,
} from '@asteasolutions/zod-to-openapi'
import type { ZodTypeAny } from 'zod'
import { z } from '../zod'
import { CropSchema } from '../constants/crops'
import { IssueSchema } from '../constants/issues'
import { ProvinceSchema } from '../constants/provinces'
import { SeverityBandSchema } from '../constants/severity'
import { ConfidenceBandSchema, VerificationStateSchema } from '../constants/verification'
import { AlertTypeSchema, RiskLevelSchema } from '../schemas/alert'
import { DistrictSlugSchema, GeoPointSchema } from '../schemas/common'
import { ExpertReviewReasonSchema } from '../schemas/diagnosis'
import {
  InterventionSchema,
  InterventionTypeSchema,
  ObservationIdSchema,
  ObservationStatusSchema,
  OutcomeSchema,
  PhotoPathSchema,
} from '../schemas/observation'
import { ChemicalOptionSchema } from '../schemas/recommendation'
import { RegistrationNoSchema } from '../schemas/registeredProduct'
import {
  AlertListSchema,
  AlertPushDataSchema,
  AlertsQuerySchema,
  AlertViewSchema,
  CreateObservationRequestSchema,
  DiagnosisViewSchema,
  ErrorResponseSchema,
  HealthResponseSchema,
  InterventionRequestSchema,
  ObservationCreatedSchema,
  ObservationViewSchema,
  OutcomeRequestSchema,
  RecommendationViewSchema,
  SourceSchema,
  VerifyRequestSchema,
} from '../schemas/api'

// Every named schema, registered in its non-null form before any path. The generator builds
// a component from the first usage it meets; if that usage is .nullable(), the shared
// component itself comes out nullable everywhere. Registering first makes nullable usages
// wrap the $ref instead.
const COMPONENTS: Record<string, ZodTypeAny> = {
  Crop: CropSchema,
  Issue: IssueSchema,
  Province: ProvinceSchema,
  GeoPoint: GeoPointSchema,
  DistrictSlug: DistrictSlugSchema,
  ObservationId: ObservationIdSchema,
  PhotoPath: PhotoPathSchema,
  ObservationStatus: ObservationStatusSchema,
  VerificationState: VerificationStateSchema,
  ConfidenceBand: ConfidenceBandSchema,
  SeverityBand: SeverityBandSchema,
  ExpertReviewReason: ExpertReviewReasonSchema,
  RegistrationNo: RegistrationNoSchema,
  ChemicalOption: ChemicalOptionSchema,
  Source: SourceSchema,
  Diagnosis: DiagnosisViewSchema,
  Recommendation: RecommendationViewSchema,
  InterventionType: InterventionTypeSchema,
  Intervention: InterventionSchema,
  Outcome: OutcomeSchema,
  RiskLevel: RiskLevelSchema,
  AlertType: AlertTypeSchema,
  Alert: AlertViewSchema,
  // Not an HTTP body: documents the FCM payload so it is frozen with everything else.
  AlertPushData: AlertPushDataSchema,
}

export const API_VERSION = '1.0.0'

const ERRORS = {
  400: 'validation_failed: the request did not match the schema (see issues).',
  401: 'unauthorized: missing or invalid Firebase ID token.',
  403: 'forbidden: signed in, but not allowed to act on this resource.',
  404: 'not_found',
} as const

const json = (schema: ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})

const body = (schema: ZodTypeAny): ZodRequestBody => ({
  required: true,
  content: { 'application/json': { schema } },
})

const errors = (...codes: (keyof typeof ERRORS)[]) =>
  Object.fromEntries(codes.map(code => [code, json(ErrorResponseSchema, ERRORS[code])]))

type OpenApiDocument = ReturnType<OpenApiGeneratorV3['generateDocument']>
type Node = Record<string, unknown>

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// The generator writes a nullable $ref as allOf: [{ $ref }, { nullable: true }]. In OpenAPI
// 3.0.3 `nullable` only takes effect beside `type`, so strict client generators would read
// those fields as non-null. Rewrite each as { type, nullable: true, allOf: [{ $ref }] }.
function fixNullableRefs(doc: OpenApiDocument) {
  const components = (doc.components?.schemas ?? {}) as Record<string, Node>
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!isNode(node)) return
    for (const [key, value] of Object.entries(node)) {
      const allOf = isNode(value) && Array.isArray(value.allOf) ? value.allOf : null
      const [first, second] = allOf ?? []
      if (allOf?.length === 2 && isNode(first) && isNode(second) && second.nullable === true) {
        const ref = String(first.$ref)
        const { nullable, ...rest } = second
        node[key] = {
          ...rest,
          type: components[ref.split('/').pop()!].type,
          nullable,
          allOf: [{ $ref: ref }],
        }
      } else {
        visit(value)
      }
    }
  }
  visit(doc)
  return doc
}

export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry()
  for (const [name, schema] of Object.entries(COMPONENTS)) registry.register(name, schema)

  const bearer = registry.registerComponent('securitySchemes', 'firebaseIdToken', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'Firebase Auth ID token. Anonymous sign-in is enough for farmers; officer permissions come from the `role` custom claim.',
  })
  const security = [{ [bearer.name]: [] }]
  const obsParams = z.object({ id: ObservationIdSchema })

  registry.registerPath({
    method: 'get',
    path: '/health',
    operationId: 'getHealth',
    tags: ['system'],
    summary: 'Liveness check',
    security: [],
    responses: { 200: json(HealthResponseSchema, 'Service is up.') },
  })

  registry.registerPath({
    method: 'post',
    path: '/observations',
    operationId: 'createObservation',
    tags: ['observations'],
    summary: 'Report an observation',
    description:
      'Call after the photos are in Storage at observations/{uid}/{obs_id}/{n}.jpg. Diagnosis starts immediately; follow progress by listening to the Firestore document observations/{obs_id}, or by polling GET /observations/{id}. First writer wins on obs_id: repeating the call as the same user is safe and returns 200 with the current status; the same obs_id from a different user returns 403, as does a photo path under another uid.',
    security,
    request: { body: body(CreateObservationRequestSchema) },
    responses: {
      201: json(ObservationCreatedSchema, 'Created; diagnosis has started.'),
      200: json(ObservationCreatedSchema, 'Already created by this reporter (retry).'),
      ...errors(400, 401, 403),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/observations/{id}',
    operationId: 'getObservation',
    tags: ['observations'],
    summary: 'Get an observation with its diagnosis and recommendation',
    description:
      'Readable by the reporter, officers of the same org, and extension officers, agronomists and admins. Never includes the precise location.',
    security,
    request: { params: obsParams },
    responses: {
      200: json(ObservationViewSchema, 'The observation.'),
      ...errors(401, 403, 404),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/observations/{id}/verify',
    operationId: 'verifyObservation',
    tags: ['observations'],
    summary: 'Confirm or correct the diagnosis (officers)',
    description:
      'Roles: field_officer (own org only), extension_officer, agronomist, admin. Moves verification_state up the ladder and, if the observation was awaiting expert review, releases it for a recommendation.',
    security,
    request: { params: obsParams, body: body(VerifyRequestSchema) },
    responses: {
      200: json(ObservationViewSchema, 'The updated observation.'),
      ...errors(400, 401, 403, 404),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/observations/{id}/intervention',
    operationId: 'recordIntervention',
    tags: ['observations'],
    summary: 'Record what was done',
    description: 'The reporter or an officer. Products must be registration numbers.',
    security,
    request: { params: obsParams, body: body(InterventionRequestSchema) },
    responses: {
      200: json(ObservationViewSchema, 'The updated observation.'),
      ...errors(400, 401, 403, 404),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/observations/{id}/outcome',
    operationId: 'recordOutcome',
    tags: ['observations'],
    summary: 'Record the follow-up outcome',
    description: 'The reporter or an officer.',
    security,
    request: { params: obsParams, body: body(OutcomeRequestSchema) },
    responses: {
      200: json(ObservationViewSchema, 'The updated observation.'),
      ...errors(400, 401, 403, 404),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/alerts',
    operationId: 'listAlerts',
    tags: ['alerts'],
    summary: 'Current alerts for a district',
    description: 'Push equivalents arrive on FCM topic alerts-{district slug}; see AlertPushData.',
    security,
    request: { query: AlertsQuerySchema },
    responses: {
      200: json(AlertListSchema, 'Newest first.'),
      ...errors(400, 401),
    },
  })

  const doc = new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'CropWatch API',
      version: API_VERSION,
      description:
        'REST v1 for the CropWatch mobile app. Generated from packages/shared Zod schemas; do not edit by hand. FROZEN: changes only add optional fields (no renames, removals or type changes), so clients MUST ignore unknown fields and MUST treat an unrecognised enum value as generic: an unknown status as in-progress, an unknown issue as "unknown", anything else as unknown, never as an error. Confidence and severity appear only as qualitative bands, never as numbers.',
    },
    servers: [{ url: '/api/v1', description: 'Relative to the Cloud Run service URL.' }],
    tags: [
      { name: 'system', description: 'Service status.' },
      {
        name: 'observations',
        description:
          'Report a crop-health problem and follow its diagnosis, recommendation and outcome.',
      },
      { name: 'alerts', description: 'Area alerts from clusters and the prototype risk signal.' },
    ],
  })
  return fixNullableRefs(doc)
}
