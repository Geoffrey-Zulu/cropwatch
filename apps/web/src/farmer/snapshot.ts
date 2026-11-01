import { FieldCardSchema, StatementSchema, type FieldCard, type Statement } from '@repo/shared'
import raw from './snapshot.json'

// Given Mweemba in January, his officer's ground check landed: the farmer app's whole world,
// baked into the bundle (tools/seed/farmer-snapshot.ts writes it). Parsed against the same
// schemas as the API's answers. The app keeps everything after it in memory: a refresh resets.
export interface FarmerSnapshot {
  org: string
  today: string
  wallet: string
  phone: string
  card: FieldCard
  statement: Statement
}

export const SNAPSHOT: FarmerSnapshot = {
  org: raw.org,
  today: raw.today,
  wallet: raw.wallet,
  phone: raw.phone,
  card: FieldCardSchema.parse(raw.card),
  statement: StatementSchema.parse(raw.statement),
}
