import {
  ALERT_CLASS_LABELS,
  alertClassOf,
  alertUncertainty,
  ISSUE_LABELS,
  type Alert,
  type AlertClass,
  type AlertPushData,
} from '@repo/shared'

// Alert copy (technicaldoc §10), English. Nyanja is a cut line: templates would sit beside these.
// A level never appears without its contributing factors (CLAUDE.md invariant 2), every alert
// says what it rests on and how sure it is (its class), and simulated alerts say so
// (invariant 5). No em dashes (design-system/phytos/MASTER.md §9).

export const LEVEL_WORDS: Record<Alert['level'], string> = {
  LOW: 'Low',
  ELEVATED: 'Watch',
  HIGH: 'Act now',
}

// The shortest honest statement of the class, for an SMS.
const SMS_CLASS: Record<AlertClass, string> = {
  weather_advisory: 'Forecast only',
  verified_cluster: 'Verified by an officer',
  model_risk_signal: 'Not yet verified by an officer',
}

const issueName = (alert: Pick<Alert, 'issue'>) =>
  alert.issue === 'unknown' ? 'A crop problem' : ISSUE_LABELS[alert.issue]

const uncertainty = (alert: Alert) =>
  alertUncertainty(alertClassOf(alert), {
    verified: alert.verified_reports ?? 0,
    reports: alert.observation_ids.length,
  })

export function pushCopy(alert: Alert) {
  const demo = alert.sim ? 'DEMO · ' : ''
  return {
    title: `${demo}${LEVEL_WORDS[alert.level]}: ${issueName(alert)} near ${alert.district}`,
    body: `${ALERT_CLASS_LABELS[alertClassOf(alert)]}. ${alert.contributing_factors.join('. ')}. ${uncertainty(alert)} Check your crop and talk to an extension officer.`,
  }
}

// FCM data payload (frozen contract AlertPushData): every value a string.
export function pushData(alertId: string, alert: Alert): AlertPushData {
  const { title, body } = pushCopy(alert)
  return {
    alert_id: alertId,
    type: alert.type,
    issue: alert.issue,
    district: alert.district,
    district_slug: alert.district_slug,
    level: alert.level,
    title,
    body,
    sim: alert.sim ? 'true' : 'false',
  }
}

// One SMS (two segments at most): the level, the problem, the place, the leading factor, how
// sure it is, and what to do. No links: many farmers' phones have no data.
export function smsCopy(alert: Alert) {
  const demo = alert.sim ? 'Phytos DEMO alert' : 'Phytos alert'
  return `${demo} (${LEVEL_WORDS[alert.level]}): ${issueName(alert)} near ${alert.district}. ${alert.contributing_factors[0]}. ${SMS_CLASS[alertClassOf(alert)]}. Check your crop and ask your extension officer.`
}
