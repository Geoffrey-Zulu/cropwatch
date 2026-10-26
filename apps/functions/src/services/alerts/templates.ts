import { ISSUE_LABELS, type Alert, type AlertPushData } from '@repo/shared'

// Alert copy (technicaldoc §10), English. Nyanja is a cut line: templates would sit beside these.
// A level never appears without its contributing factors (CLAUDE.md invariant 2), and simulated
// alerts say so (invariant 5).

export const LEVEL_WORDS: Record<Alert['level'], string> = {
  LOW: 'Low',
  ELEVATED: 'Watch',
  HIGH: 'Act now',
}

const issueName = (alert: Pick<Alert, 'issue'>) =>
  alert.issue === 'unknown' ? 'A crop problem' : ISSUE_LABELS[alert.issue]

export function pushCopy(alert: Alert) {
  const demo = alert.sim ? 'DEMO · ' : ''
  return {
    title: `${demo}${LEVEL_WORDS[alert.level]}: ${issueName(alert)} near ${alert.district}`,
    body: `${alert.contributing_factors.join('. ')}. Check your crop and talk to an extension officer.`,
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

// One SMS (160 GSM characters where possible): the level, the problem, the place, the leading
// factor, and what to do. No links: many farmers' phones have no data.
export function smsCopy(alert: Alert) {
  const demo = alert.sim ? 'CropWatch DEMO alert' : 'CropWatch alert'
  return `${demo} (${LEVEL_WORDS[alert.level]}): ${issueName(alert)} near ${alert.district}. ${alert.contributing_factors[0]}. Check your crop and ask your extension officer.`
}
