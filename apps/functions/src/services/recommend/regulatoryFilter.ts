import {
  ChemicalOptionSchema,
  type ChemicalOption,
  type Crop,
  type Issue,
  type RegisteredProduct,
} from '@repo/shared'
import type { ChemicalCandidate } from './knowledge'

// The chemical firewall (CLAUDE.md invariant 1, technicaldoc §8). Deterministic: a candidate
// becomes an option only through a registered_products row approved for this crop AND issue
// and unexpired; everything shown comes from that row, so label_dose is byte-identical.

export type RejectionReason =
  'not_registered' | 'wrong_crop' | 'wrong_issue' | 'expired' | 'placeholder'

export interface Rejection {
  candidate: string
  reason: RejectionReason
}

export interface FilterInput {
  candidates: ChemicalCandidate[]
  products: RegisteredProduct[]
  crop: Crop
  issue: Issue
  // YYYY-MM-DD; a product is valid through its expiry date.
  today: string
  // Placeholder rows are test data. Only tests and explicit demo set-ups may allow them.
  allowPlaceholders?: boolean
}

export interface FilterResult {
  options: ChemicalOption[]
  rejected: Rejection[]
}

// For matching names only; never applied to anything shown.
const normalise = (text: string) => text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()

const nameOf = (candidate: ChemicalCandidate) =>
  candidate.registration_no ?? candidate.trade_name ?? candidate.active_ingredient ?? '(unnamed)'

function matches(product: RegisteredProduct, candidate: ChemicalCandidate) {
  // A registration number is an identifier: exact match only.
  if (candidate.registration_no) return product.registration_no === candidate.registration_no
  if (candidate.trade_name) return normalise(product.trade_name) === normalise(candidate.trade_name)
  if (candidate.active_ingredient) {
    return normalise(product.active_ingredient) === normalise(candidate.active_ingredient)
  }
  return false
}

function ineligibility(
  product: RegisteredProduct,
  { crop, issue, today, allowPlaceholders = false }: FilterInput
): RejectionReason | null {
  if (product.source === 'placeholder' && !allowPlaceholders) return 'placeholder'
  if (!product.approved_crops.includes(crop)) return 'wrong_crop'
  if (!(product.approved_issues as readonly string[]).includes(issue)) return 'wrong_issue'
  if (product.expiry !== null && product.expiry < today) return 'expired'
  return null
}

export function filterChemicalCandidates(input: FilterInput): FilterResult {
  const options = new Map<string, ChemicalOption>()
  const rejected: Rejection[] = []

  for (const candidate of input.candidates) {
    const matched = input.products
      .filter(product => matches(product, candidate))
      .sort((a, b) => a.registration_no.localeCompare(b.registration_no))
    if (matched.length === 0) {
      rejected.push({ candidate: nameOf(candidate), reason: 'not_registered' })
      continue
    }
    const eligible = matched.filter(product => ineligibility(product, input) === null)
    if (eligible.length === 0) {
      rejected.push({ candidate: nameOf(candidate), reason: ineligibility(matched[0], input)! })
      continue
    }
    // Every eligible row for the candidate, e.g. all registered brands of an active ingredient.
    for (const product of eligible) {
      options.set(product.registration_no, ChemicalOptionSchema.parse(product))
    }
  }

  return {
    options: [...options.values()].sort(
      (a, b) =>
        a.trade_name.localeCompare(b.trade_name) ||
        a.registration_no.localeCompare(b.registration_no)
    ),
    rejected,
  }
}
