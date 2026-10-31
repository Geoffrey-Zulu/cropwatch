import {
  balance,
  CEIH_SEASON,
  establishmentNdvi,
  eligibilityLabel,
  evaluateEligibility,
  ISSUE_LABELS,
  latestStatus,
  LEDGER_LABELS,
  maskMsisdn,
  MOMO_LABELS,
  ndviText,
  projectedTonnes,
  recovered,
  SATELLITE_STATUS_LABELS,
  seasonNow,
  shortDate,
  variance,
  VERIFICATION_WINDOW_DAYS,
  visiblePasses,
  zmw,
  daysBetween,
  type Advance,
  type AdvanceSummary,
  type Approval,
  type CeihDemoState,
  type Contract,
  type CreditConfig,
  type Delivery,
  type Eligibility,
  type Farmer,
  type FieldCard,
  type GroundCheck,
  type LedgerEntry,
  type Observation,
  type Portfolio,
  type RainfallSeries,
  type Reconciliation,
  type RecordObservation,
  type Role,
  type SatelliteMetrics,
  type SeasonRow,
  type SmsLog,
  type SmsLogView,
  type Statement,
  type TimelineEntry,
  type WeatherTrigger,
} from '@repo/shared'

// Everything the CEIH views read for one org, loaded once a request (store.ts). Pure from here:
// every figure on the dashboard is computed from these rows, never stored (spec §6.3).
export interface SeasonData {
  org: { id: string; name: string; credit: CreditConfig; sim: boolean }
  state: CeihDemoState
  farmers: { id: string; data: Farmer }[]
  contracts: { id: string; data: Contract }[]
  metrics: { id: string; data: SatelliteMetrics }[]
  advances: { id: string; data: Advance }[]
  ledger: { id: string; data: LedgerEntry }[]
  deliveries: { id: string; data: Delivery }[]
  triggers: { id: string; data: WeatherTrigger }[]
  rainfall: { id: string; data: RainfallSeries }[]
  sms: { id: string; data: SmsLog }[]
  // Observations linked to the org's farmers, with the internal severity where there is one.
  observations: { id: string; data: Observation; severity_pct: number | null }[]
  users: Map<string, { role: Role; display_name: string | null }>
}

export const seasonToday = (data: SeasonData, realNow: string) =>
  seasonNow(realNow, data.state.offset_days)

// A person as the screens name them: "Officer M. Banda", "C. Lungu (credit)".
export function personLabel(data: SeasonData, uid: string | null | undefined): string {
  if (!uid) return 'an officer'
  const user = data.users.get(uid)
  if (!user?.display_name) return user ? 'a Command Center officer' : 'an officer'
  const [first, ...rest] = user.display_name.split(' ')
  const short = rest.length ? `${first[0]}. ${rest.join(' ')}` : first
  return user.role === 'credit' ? `${short} (credit)` : `Officer ${short}`
}

const byContract = <T extends { data: { contract_id: string } }>(rows: T[], id: string) =>
  rows.filter(r => r.data.contract_id === id)

// When an observation happened on the season calendar.
export const observationSeasonAt = (data: SeasonData, o: Observation) =>
  o.season_at ?? seasonNow(o.created_at, data.state.offset_days)

// What counts on a farmer's record today: seeded rows, and real reports since this arming (a real
// report linked in an earlier rehearsal is left alone, never edited).
function recordOf(data: SeasonData, farmerId: string, today: string) {
  return data.observations.filter(
    o =>
      o.data.farmer_id === farmerId &&
      (o.data.sim || o.data.created_at >= data.state.armed_at) &&
      observationSeasonAt(data, o.data) <= today
  )
}

export function recordObservations(
  data: SeasonData,
  farmerId: string,
  today: string
): RecordObservation[] {
  return recordOf(data, farmerId, today).map(({ id, data: o, severity_pct }) => ({
    id,
    at: observationSeasonAt(data, o),
    verification_state: o.verification_state,
    verified_by: o.verified_by,
    growth_stage: o.growth_stage,
    geofence_ok: o.geofence_ok,
    issue: o.verified_issue ?? o.diagnosis?.suspected_issue ?? null,
    severity_pct,
    severity_band: o.diagnosis?.severity_band ?? null,
    intervention: o.intervention !== null,
    resolved: o.outcome?.resolved ?? false,
  }))
}

// A contract as it stands on the season day: its shock flag only once raised.
function contractToday(contract: Contract, today: string): Contract {
  return contract.shock_flag && contract.shock_flag.triggered_at > today
    ? { ...contract, shock_flag: null }
    : contract
}

const visibleRows = <T extends { data: { at: string } }>(rows: T[], today: string) =>
  rows.filter(r => r.data.at <= today)

export function advanceOf(data: SeasonData, contractId: string, today: string) {
  return (
    byContract(data.advances, contractId)
      .filter(a => a.data.requested_at <= today)
      .sort((a, b) => b.data.requested_at.localeCompare(a.data.requested_at))[0] ?? null
  )
}

export function eligibilityFor(data: SeasonData, contractId: string, today: string): Eligibility {
  const contract = data.contracts.find(c => c.id === contractId)!
  const farmer = data.farmers.find(f => f.id === contract.data.farmer_id)!
  const metrics = data.metrics.find(m => m.id === contractId)
  const open = byContract(data.advances, contractId).find(
    a => a.data.requested_at <= today && !['declined', 'failed'].includes(a.data.state)
  )
  return evaluateEligibility({
    now: today,
    contract: contractToday(contract.data, today),
    farmer: farmer.data,
    passes: visiblePasses(metrics?.data.passes ?? [], today),
    observations: recordObservations(data, farmer.id, today),
    credit: data.org.credit,
    openAdvance: open ? { amount_zmw: open.data.amount_zmw, state: open.data.state } : null,
    officerLabel: uid => personLabel(data, uid),
  })
}

function advanceSummary(advance: { id: string; data: Advance } | null): AdvanceSummary | null {
  if (!advance) return null
  return {
    advance_id: advance.id,
    state: advance.data.state,
    amount_zmw: advance.data.amount_zmw,
    fee_zmw: advance.data.fee_zmw,
    requested_at: advance.data.requested_at,
    simulated: advance.data.disbursement?.status === 'simulated',
  }
}

function verifiedState(
  data: SeasonData,
  contractId: string,
  e: Eligibility,
  today: string
): SeasonRow['verified'] {
  const contract = data.contracts.find(c => c.id === contractId)!.data
  const passes = visiblePasses(
    data.metrics.find(m => m.id === contractId)?.data.passes ?? [],
    today
  )
  const clear = passes.filter(p => p.usable)
  const lastClear = clear[clear.length - 1]
  const ground = e.factors.find(f => f.code === 'established' && f.source === 'officer' && f.met)
  const groundDate = ground
    ? (recordObservations(data, contract.farmer_id, today)
        .filter(o => o.verified_by && e.verifier_ids.includes(o.verified_by))
        .map(o => o.at.slice(0, 10))
        .sort()
        .pop() ?? null)
    : null
  if (e.established_by === 'satellite')
    return {
      state: 'satellite',
      label: ground ? 'Satellite and officer' : 'Satellite',
      date: lastClear?.date ?? null,
    }
  if (e.established_by === 'officer')
    return { state: 'officer', label: 'Officer', date: groundDate }
  const status = latestStatus(passes)
  if (status === 'not_planted')
    return { state: 'not_planted', label: 'Not planted', date: lastClear?.date ?? null }
  if (status === 'field_stress')
    return { state: 'field_stress', label: 'Stress on this field', date: lastClear?.date ?? null }
  if (status === 'shared_stress')
    return {
      state: 'shared_stress',
      label: 'Stress across the camp',
      date: lastClear?.date ?? null,
    }
  if (daysBetween(contract.planting_date, today) < 35)
    return { state: 'too_early', label: 'Too early to see', date: null }
  return { state: 'cloud_gap', label: 'Cloud gap', date: lastClear?.date ?? null }
}

export function seasonRow(data: SeasonData, contractId: string, today: string): SeasonRow {
  const contract = data.contracts.find(c => c.id === contractId)!
  const farmer = data.farmers.find(f => f.id === contract.data.farmer_id)!
  const e = eligibilityFor(data, contractId, today)
  const passes = visiblePasses(
    data.metrics.find(m => m.id === contractId)?.data.passes ?? [],
    today
  )
  const rows = visibleRows(byContract(data.ledger, contractId), today)
  return {
    contract_id: contractId,
    farmer_id: farmer.id,
    farmer_name: farmer.data.name,
    camp: contract.data.camp,
    district: contract.data.district,
    crop: contract.data.crop,
    contracted_ha: contract.data.contracted_ha,
    verified: verifiedState(data, contractId, e, today),
    eligible: e.eligible,
    eligibility_label: eligibilityLabel(e),
    cap_zmw: e.cap_zmw,
    advance: advanceSummary(advanceOf(data, contractId, today)),
    exposure_zmw: Math.max(0, balance(rows.map(r => r.data))),
    shock: contractToday(contract.data, today).shock_flag !== null,
    spark: passes.slice(-12).map(p => (p.usable ? p.ndvi : null)),
    sim: contract.data.sim || farmer.data.sim,
  }
}

export function portfolio(data: SeasonData, today: string): Portfolio {
  const rows = data.contracts.map(c => seasonRow(data, c.id, today))
  const ledger = visibleRows(data.ledger, today).map(l => l.data)
  const camps = [...new Set(data.contracts.map(c => c.data.camp))].sort()
  return {
    org_id: data.org.id,
    name: data.org.name,
    season: data.contracts[0]?.data.season ?? CEIH_SEASON,
    today,
    phase: data.state.phase,
    contracts: rows.length,
    projected_value_zmw: data.contracts.reduce((n, c) => n + c.data.projected_value_zmw, 0),
    input_loans_zmw: ledger
      .filter(l => l.type === 'input_loan')
      .reduce((n, l) => n + l.amount_zmw, 0),
    advances_out_zmw: ledger
      .filter(l => l.type === 'advance')
      .reduce((n, l) => n + l.amount_zmw, 0),
    recovered_zmw: data.contracts.reduce(
      (n, c) => n + Math.max(0, recovered(ledger.filter(l => l.contract_id === c.id))),
      0
    ),
    shock_camps: camps.filter(camp => rows.some(r => r.camp === camp && r.shock)),
    verified: rows.filter(r => r.verified.state === 'satellite' || r.verified.state === 'officer')
      .length,
    eligible: rows.filter(r => r.eligible).length,
    awaiting_approval: data.advances.filter(
      a => a.data.state === 'farmer_confirmed' && a.data.requested_at <= today
    ).length,
    credit: data.org.credit,
    camps,
    rows,
    sim: data.org.sim || rows.some(r => r.sim),
  }
}

function groundChecks(data: SeasonData, farmerId: string, today: string): GroundCheck[] {
  return recordOf(data, farmerId, today)
    .sort((a, b) =>
      observationSeasonAt(data, b.data).localeCompare(observationSeasonAt(data, a.data))
    )
    .map(({ id, data: o }) => {
      const issue = o.verified_issue ?? o.diagnosis?.suspected_issue ?? null
      return {
        obs_id: id,
        at: observationSeasonAt(data, o),
        stage: o.growth_stage,
        verification: o.verification_state,
        verified_by: o.verified_by,
        verified_by_label: o.verified_by ? personLabel(data, o.verified_by) : null,
        geofence_ok: o.geofence_ok ?? null,
        issue_label: issue && issue !== 'unknown' ? ISSUE_LABELS[issue] : null,
        photo_paths: o.photo_paths,
        sim: o.sim,
      }
    })
}

function timeline(
  data: SeasonData,
  contract: { id: string; data: Contract },
  today: string
): TimelineEntry[] {
  const c = contract.data
  const entries: TimelineEntry[] = []
  const farmer = data.farmers.find(f => f.id === c.farmer_id)!.data
  if (c.inputs_delivered && c.inputs_delivered.at <= today)
    entries.push({
      at: c.inputs_delivered.at,
      kind: 'inputs',
      source: 'officer',
      text: `Inputs handed over (${zmw(c.input_loan_zmw)} on loan)${c.inputs_delivered.otp_confirmed ? " and acknowledged with the farmer's SMS code" : ''}${farmer.consent ? ` · ${personLabel(data, farmer.consent.officer_id)}` : ''}`,
    })
  if (`${c.planting_date}T00:00:00.000Z` <= today)
    entries.push({
      at: `${c.planting_date}T00:00:00.000Z`,
      kind: 'planted',
      source: 'farmer',
      text: 'Planted, the contract date reported by the farmer',
    })

  const passes = visiblePasses(
    data.metrics.find(m => m.id === contract.id)?.data.passes ?? [],
    today
  )
  const threshold = establishmentNdvi(c.crop)
  const firstEstablished = passes.find(
    p => p.usable && p.ndvi !== null && p.ndvi >= threshold && p.status_derived === 'established'
  )
  if (firstEstablished)
    entries.push({
      at: `${firstEstablished.date}T06:00:00.000Z`,
      kind: 'satellite',
      source: 'satellite',
      text: `Established, on track · NDVI ${ndviText(firstEstablished.ndvi!)}${firstEstablished.ndvi_camp_median !== null ? ` vs camp ${ndviText(firstEstablished.ndvi_camp_median)}` : ''}`,
    })
  const recent = passes.filter(p => daysBetween(p.date, today) <= VERIFICATION_WINDOW_DAYS)
  const clouded = recent.filter(p => !p.usable)
  if (clouded.length)
    entries.push({
      at: `${clouded[clouded.length - 1].date}T06:00:00.000Z`,
      kind: 'satellite',
      source: 'satellite',
      text: `No clear pass on ${clouded.map(p => shortDate(p.date)).join(', ')}: clouded out`,
    })
  const stressed = passes.find(
    p =>
      p.status_derived === 'field_stress' ||
      p.status_derived === 'shared_stress' ||
      p.status_derived === 'not_planted'
  )
  const latestClear = [...passes].reverse().find(p => p.usable)
  if (latestClear && latestClear !== firstEstablished)
    entries.push({
      at: `${latestClear.date}T06:00:00.000Z`,
      kind: 'satellite',
      source: 'satellite',
      text: `${SATELLITE_STATUS_LABELS[latestClear.status_derived]} · NDVI ${ndviText(latestClear.ndvi!)}${latestClear.ndvi_camp_median !== null ? ` vs camp ${ndviText(latestClear.ndvi_camp_median)}` : ''}`,
    })
  else if (stressed && stressed !== latestClear)
    entries.push({
      at: `${stressed.date}T06:00:00.000Z`,
      kind: 'satellite',
      source: 'satellite',
      text: SATELLITE_STATUS_LABELS[stressed.status_derived],
    })

  for (const g of groundChecks(data, c.farmer_id, today)) {
    const verified = g.verification === 'FIELD_VERIFIED' || g.verification === 'EXPERT_CONFIRMED'
    const where =
      g.geofence_ok === false
        ? ' · outside the field, does not count'
        : g.geofence_ok
          ? ' · inside the field'
          : ''
    entries.push({
      at: g.at,
      kind: g.issue_label ? 'issue' : 'ground_check',
      source: verified ? 'officer' : 'ai',
      text: g.issue_label
        ? `${g.issue_label}${verified ? `, verified by ${g.verified_by_label}` : ', assessed by AI'}${g.stage ? ` · stage ${g.stage}` : ''}${where}`
        : verified
          ? `Field verified by ${g.verified_by_label}${g.stage ? ` · stage ${g.stage}` : ''}${where}`
          : `Photo received, waiting for an officer to verify it${where}`,
    })
    const o = data.observations.find(x => x.id === g.obs_id)?.data
    if (o?.intervention)
      entries.push({
        at: observationSeasonAt(data, o),
        kind: 'intervention',
        source: 'officer',
        text: `Treated (${o.intervention.type}): ${o.intervention.notes}`,
      })
  }

  for (const a of byContract(data.advances, contract.id).filter(
    x => x.data.requested_at <= today
  )) {
    const d = a.data
    entries.push({
      at: d.requested_at,
      kind: 'advance',
      source: 'officer',
      text: `Advance of ${zmw(d.amount_zmw)} requested, fee ${zmw(d.fee_zmw)} shown to the farmer`,
    })
    if (d.farmer_confirmed?.otp_ok && d.farmer_confirmed.at <= today)
      entries.push({
        at: d.farmer_confirmed.at,
        kind: 'advance',
        source: 'farmer',
        text: 'Confirmed by the farmer with the SMS code',
      })
    if (d.approval && d.approval.at <= today)
      entries.push({
        at: d.approval.at,
        kind: 'advance',
        source: 'officer',
        text: `Approved by ${personLabel(data, d.approval.approver_id)}`,
      })
    if (d.disbursement && d.disbursement.at <= today)
      entries.push({
        at: d.disbursement.at,
        kind: 'advance',
        source: 'officer',
        text: `${zmw(d.amount_zmw)} sent to ${MOMO_LABELS[farmer.momo_provider]}${d.disbursement.status === 'simulated' ? ' (simulated transfer)' : ''}`,
      })
    if (d.decline && d.decline.at <= today)
      entries.push({
        at: d.decline.at,
        kind: 'advance',
        source: 'officer',
        text: `Declined: ${d.decline.reason}`,
      })
  }
  for (const d of visibleRows(byContract(data.deliveries, contract.id), today))
    entries.push({
      at: d.data.at,
      kind: 'delivery',
      source: 'officer',
      text: `Delivered ${(d.data.weight_kg / 1000).toFixed(2)} t grade ${d.data.grade}, ${zmw(d.data.value_zmw)}`,
    })
  const shock = contractToday(c, today).shock_flag
  if (shock)
    entries.push({
      at: shock.triggered_at,
      kind: 'shock',
      source: 'satellite',
      text: `Drought flag on ${shock.camp}: rain and the camp's curve agree. Shortfall marked uncontrollable`,
    })
  return entries.sort((a, b) => a.at.localeCompare(b.at))
}

export function fieldCard(data: SeasonData, contractId: string, today: string): FieldCard | null {
  const contract = data.contracts.find(c => c.id === contractId)
  if (!contract) return null
  const farmer = data.farmers.find(f => f.id === contract.data.farmer_id)!
  const metrics = data.metrics.find(m => m.id === contractId)
  const passes = visiblePasses(metrics?.data.passes ?? [], today)
  const e = eligibilityFor(data, contractId, today)
  const status = latestStatus(passes)
  return {
    contract_id: contractId,
    farmer_id: farmer.id,
    farmer_name: farmer.data.name,
    camp: contract.data.camp,
    district: contract.data.district,
    crop: contract.data.crop,
    planting_date: contract.data.planting_date,
    today,
    contracted_ha: contract.data.contracted_ha,
    projected_value_zmw: contract.data.projected_value_zmw,
    input_loan_zmw: contract.data.input_loan_zmw,
    status,
    status_label: SATELLITE_STATUS_LABELS[status],
    curve: passes.map(p => ({
      date: p.date,
      ndvi: p.usable ? p.ndvi : null,
      camp_median: p.ndvi_camp_median,
      usable: p.usable,
      cloud_pct: p.cloud_pct,
      status: p.status_derived,
    })),
    curve_source: metrics?.data.source ?? 'seeded',
    timeline: timeline(data, contract, today),
    eligibility: e,
    ground_checks: groundChecks(data, farmer.id, today),
    advance: advanceSummary(advanceOf(data, contractId, today)),
    momo_label: MOMO_LABELS[farmer.data.momo_provider],
    phone_masked: maskMsisdn(farmer.data.phone_msisdn),
    credit: data.org.credit,
    shock: contractToday(contract.data, today).shock_flag,
    sim: contract.data.sim || farmer.data.sim || (metrics?.data.sim ?? false),
  }
}

export function approvals(data: SeasonData, today: string, callerUid: string): Approval[] {
  return data.advances
    .filter(
      a => ['requested', 'farmer_confirmed'].includes(a.data.state) && a.data.requested_at <= today
    )
    .sort((a, b) => b.data.requested_at.localeCompare(a.data.requested_at))
    .flatMap(a => {
      const card = fieldCard(data, a.data.contract_id, today)
      if (!card) return []
      return [
        {
          advance_id: a.id,
          contract_id: a.data.contract_id,
          state: a.data.state,
          requested_at: a.data.requested_at,
          requested_via: a.data.requested_via,
          amount_zmw: a.data.amount_zmw,
          fee_zmw: a.data.fee_zmw,
          otp_ok: a.data.farmer_confirmed?.otp_ok === true,
          eligibility_snapshot: a.data.eligibility_snapshot,
          verifier_labels: a.data.eligibility_snapshot.verifier_ids.map(uid =>
            personLabel(data, uid)
          ),
          caller_is_verifier: a.data.eligibility_snapshot.verifier_ids.includes(callerUid),
          card,
          sim: a.data.sim,
        },
      ]
    })
}

function verifiedIssueOf(data: SeasonData, farmerId: string, today: string) {
  const issue = recordObservations(data, farmerId, today).find(
    o =>
      o.issue &&
      o.issue !== 'unknown' &&
      (o.verification_state === 'FIELD_VERIFIED' || o.verification_state === 'EXPERT_CONFIRMED')
  )
  return issue ? ISSUE_LABELS[issue.issue!].toLowerCase() : null
}

export function statement(data: SeasonData, contractId: string, today: string): Statement | null {
  const contract = data.contracts.find(c => c.id === contractId)
  if (!contract) return null
  const farmer = data.farmers.find(f => f.id === contract.data.farmer_id)!
  const rows = visibleRows(byContract(data.ledger, contractId), today).sort((a, b) =>
    a.data.at.localeCompare(b.data.at)
  )
  const delivered = visibleRows(byContract(data.deliveries, contractId), today)
  const deliveredT = delivered.length
    ? Math.round(delivered.reduce((n, d) => n + d.data.weight_kg, 0) / 10) / 100
    : null
  return {
    contract_id: contractId,
    farmer_name: farmer.data.name,
    camp: contract.data.camp,
    lines: rows.map(r => ({
      at: r.data.at,
      type: r.data.type,
      label: LEDGER_LABELS[r.data.type],
      amount_zmw: r.data.amount_zmw,
      ref: r.data.ref,
      note: r.data.note,
      simulated: r.data.simulated,
    })),
    balance_zmw: balance(rows.map(r => r.data)),
    delivered_t: deliveredT,
    projected_t: projectedTonnes(contract.data),
    variance: variance({
      contract: contractToday(contract.data, today),
      deliveredT,
      verifiedIssue: verifiedIssueOf(data, farmer.id, today),
    }),
    settled: deliveredT !== null,
    sim: contract.data.sim,
  }
}

export function reconciliation(data: SeasonData, today: string): Reconciliation {
  const rows = data.contracts.flatMap(c => {
    const s = statement(data, c.id, today)
    if (!s || s.delivered_t === null) return []
    return [
      {
        contract_id: c.id,
        farmer_name: s.farmer_name,
        camp: s.camp,
        delivered_t: s.delivered_t,
        projected_t: s.projected_t,
        variance: s.variance,
        net_zmw: -s.balance_zmw,
        sim: s.sim,
      },
    ]
  })
  const fired = data.triggers.filter(t => t.data.fired && t.data.evaluated_at <= today)
  return {
    // The ones the credit team must look at first.
    rows: rows.sort(
      (a, b) =>
        ['unexplained', 'shock', 'verified_issue', 'none'].indexOf(a.variance.kind) -
          ['unexplained', 'shock', 'verified_issue', 'none'].indexOf(b.variance.kind) ||
        a.farmer_name.localeCompare(b.farmer_name)
    ),
    claim_packs: fired.map(t => ({
      trigger_id: t.id,
      camp: t.data.camp,
      trigger: t.data,
      contracts: data.contracts
        .filter(c => c.data.camp === t.data.camp && contractToday(c.data, today).shock_flag)
        .map(c => ({
          contract_id: c.id,
          farmer_name:
            data.farmers.find(f => f.id === c.data.farmer_id)?.data.name ?? c.data.farmer_id,
          contracted_ha: c.data.contracted_ha,
        })),
      rainfall_source:
        data.rainfall.find(r => r.data.camp === t.data.camp)?.data.source ?? t.data.source,
      sim: t.data.sim,
    })),
  }
}

export function smsLog(data: SeasonData): SmsLogView[] {
  return [...data.sms]
    .sort((a, b) => b.data.at.localeCompare(a.data.at))
    .slice(0, 30)
    .map(s => ({
      id: s.id,
      to_masked: maskMsisdn(s.data.to),
      farmer_name: data.farmers.find(f => f.id === s.data.farmer_id)?.data.name ?? null,
      message: s.data.message,
      purpose: s.data.purpose,
      status: s.data.status,
      at: s.data.at,
      season_at: s.data.season_at,
      sim: s.data.sim,
    }))
}
