import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import type { Messaging } from 'firebase-admin/messaging'
import { alertTopic, AlertSchema, type Alert, type AlertPushData } from '@repo/shared'
import { fromFirestore } from '../../lib/firestoreData'
import { log } from '../../lib/log'
import type { SmsSender } from './sms'
import { pushData, smsCopy } from './templates'

export interface PushSender {
  // Mobile app subscribers (frozen contract: topic alerts-{district_slug}).
  toTopic(topic: string, data: AlertPushData): Promise<void>
  // Capture PWA tokens (web clients cannot subscribe themselves to topics).
  toTokens(
    tokens: string[],
    data: AlertPushData
  ): Promise<{ sent: number; failed: number; invalid: string[] }>
}

export function fcmPush(messaging: Messaging): PushSender {
  return {
    async toTopic(topic, data) {
      await messaging.send({ topic, data, android: { priority: 'high' } })
    },
    async toTokens(tokens, data) {
      let sent = 0
      let failed = 0
      const invalid: string[] = []
      for (let i = 0; i < tokens.length; i += 500) {
        const batch = tokens.slice(i, i + 500)
        const result = await messaging.sendEachForMulticast({
          tokens: batch,
          data,
          webpush: { headers: { Urgency: 'high', TTL: '86400' } },
        })
        result.responses.forEach((r, j) => {
          if (r.success) sent++
          else {
            failed++
            const code = r.error?.code ?? ''
            if (
              code.includes('registration-token-not-registered') ||
              code.includes('invalid-registration-token')
            ) {
              invalid.push(batch[j])
            }
          }
        })
      }
      return { sent, failed, invalid }
    },
  }
}

export type DispatchOutcome = 'sent' | 'already' | 'skipped' | 'in_progress' | 'missing'
export type Dispatch = (alertId: string) => Promise<DispatchOutcome>

const CLAIM_MS = 120_000

// Pub/Sub may deliver twice: the dispatch record (alerts/{id}/internal/dispatch) is claimed in a
// transaction, so an alert goes out once. Channel failures are recorded, not retried, so a
// partial failure never sends a second push or SMS to the people who already got one.
export function firestoreDispatcher({
  db,
  push,
  sms,
}: {
  db: Firestore
  push: PushSender
  sms: SmsSender
}): Dispatch {
  return async alertId => {
    const ref = db.collection('alerts').doc(alertId)
    const record = ref.collection('internal').doc('dispatch')
    const claim = await db.runTransaction(async tx => {
      const [alert, state] = await tx.getAll(ref, record)
      if (!alert.exists) return 'missing' as const
      const current = state.get('state') as string | undefined
      if (current === 'sent') return 'already' as const
      if (current === 'skipped') return 'skipped' as const
      const claimedAt = state.get('claimed_at') as Timestamp | undefined
      if (current === 'sending' && claimedAt && Date.now() - claimedAt.toMillis() < CLAIM_MS) {
        return 'in_progress' as const
      }
      tx.set(record, { state: 'sending', claimed_at: Timestamp.now() }, { merge: true })
      return 'claimed' as const
    })
    if (claim !== 'claimed') return claim

    const started = Date.now()
    let alert: Alert
    try {
      alert = AlertSchema.parse(fromFirestore((await ref.get()).data())) as Alert
    } catch (error) {
      // Nothing has gone out yet: release the claim so Pub/Sub's retry can dispatch.
      await record.set({ state: 'pending', claimed_at: null }, { merge: true })
      throw error
    }
    const data = pushData(alertId, alert)
    const channels = new Set<'fcm' | 'sms'>()

    const topic = alertTopic(alert.district_slug)
    let topicError: string | null = null
    try {
      await push.toTopic(topic, data)
      channels.add('fcm')
    } catch (error) {
      topicError = String(error).slice(0, 300)
      log('WARNING', 'fcm topic send failed', { alert_id: alertId, error: topicError })
    }

    // Each channel fails on its own (recorded below), lookups included: a failure in one never
    // stops the others, and never makes Pub/Sub's retry reach the same people twice.
    let web = { sent: 0, failed: 0, invalid: [] as string[] }
    let webError: string | null = null
    try {
      const tokenDocs = await db
        .collectionGroup('push_tokens')
        .where('district_slug', '==', alert.district_slug)
        .get()
      const tokens = tokenDocs.docs.map(d => d.get('token') as string).filter(Boolean)
      if (tokens.length) {
        web = await push.toTokens(tokens, data)
        if (web.sent) channels.add('fcm')
        const dead = new Set(web.invalid)
        await Promise.all(
          tokenDocs.docs.filter(d => dead.has(d.get('token'))).map(d => d.ref.delete())
        )
      }
    } catch (error) {
      webError = String(error).slice(0, 300)
      log('WARNING', 'fcm web send failed', { alert_id: alertId, error: webError })
    }

    let numbers: string[] = []
    let smsSent = 0
    let smsFailed: number
    let smsError: string | null = null
    try {
      const subscribers = await db
        .collection('sms_subscribers')
        .where('district_slug', 'in', [alert.district_slug, '*'])
        .get()
      numbers = [
        ...new Set(
          subscribers.docs.filter(d => d.get('active') === true).map(d => d.get('phone') as string)
        ),
      ]
      const results = await sms.send(numbers, smsCopy(alert))
      smsSent = results.filter(r => r.ok).length
      smsFailed = results.length - smsSent
      if (smsSent) channels.add('sms')
    } catch (error) {
      smsError = String(error).slice(0, 300)
      smsFailed = numbers.length
      log('WARNING', 'sms send failed', { alert_id: alertId, error: smsError })
    }

    const batch = db.batch()
    batch.update(ref, { channels_sent: [...channels] })
    batch.set(record, {
      state: 'sent',
      claimed_at: null,
      fcm: {
        topic,
        topic_ok: topicError === null,
        topic_error: topicError,
        web_sent: web.sent,
        web_failed: web.failed,
        web_pruned: web.invalid.length,
        web_error: webError,
      },
      sms: {
        gateway: sms.name,
        recipients: numbers.length,
        sent: smsSent,
        failed: smsFailed,
        error: smsError,
      },
      dispatch_ms: Date.now() - started,
      finished_at: Timestamp.now(),
    })
    await batch.commit()
    log('INFO', 'alert dispatched', {
      alert_id: alertId,
      channels: [...channels],
      web_sent: web.sent,
      sms_sent: smsSent,
      sms_gateway: sms.name,
      dispatch_ms: Date.now() - started,
    })
    return 'sent'
  }
}
