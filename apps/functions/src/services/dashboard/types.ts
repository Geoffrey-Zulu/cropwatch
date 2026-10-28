import type { DistrictWeather, ObservationEvidence, OutgrowerOverview } from '@repo/shared'

// What the Command Center dashboard reads through the API (tRPC), because clients cannot read
// it from Firestore: internal records (sanitised), org aggregates, and the weather context.
export interface DashboardServices {
  evidence(obsId: string): Promise<ObservationEvidence | null>
  outgrower(orgId: string): Promise<OutgrowerOverview | null>
  weather(districtSlug: string): Promise<DistrictWeather | null>
}
