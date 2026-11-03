import { log } from '../../lib/log'

export interface SmsResult {
  number: string
  ok: boolean
  status: string
}

export interface SmsSender {
  // Which gateway this is, for the dispatch record.
  name: string
  send(to: string[], message: string): Promise<SmsResult[]>
}

// Africa's Talking (technicaldoc §10). The sandbox never reaches a phone: messages appear in the
// dashboard simulator. Without a registered sender ID, messages go out from Africa's Talking's
// default sender (MTN Zambia only shows a pre-registered alphanumeric ID).
export function africasTalking({
  username,
  apiKey,
  from,
  sandbox,
  fetchImpl = fetch,
}: {
  username: string
  apiKey: string
  from?: string
  sandbox: boolean
  fetchImpl?: typeof fetch
}): SmsSender {
  const url = sandbox
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging'
  return {
    name: sandbox ? 'africastalking-sandbox' : 'africastalking',
    async send(to, message) {
      if (to.length === 0) return []
      const body = new URLSearchParams({ username, to: to.join(','), message })
      if (from) body.set('from', from)
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          apiKey,
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(15_000),
      })
      const text = await response.text()
      if (!response.ok)
        throw new Error(`Africa's Talking HTTP ${response.status}: ${text.slice(0, 200)}`)
      const data = JSON.parse(text) as {
        SMSMessageData?: { Recipients?: { number: string; status: string; statusCode: number }[] }
      }
      // 100 processed, 101 sent, 102 queued; anything else did not go.
      return (data.SMSMessageData?.Recipients ?? []).map(r => ({
        number: r.number,
        ok: [100, 101, 102].includes(r.statusCode),
        status: r.status,
      }))
    },
  }
}

// Until the Africa's Talking account exists: record what would have been sent.
export const smsLogOnly: SmsSender = {
  name: 'log-only (no SMS gateway configured)',
  async send(to, message) {
    log('INFO', 'sms not sent: no gateway configured', {
      recipients: to.length,
      chars: message.length,
    })
    return to.map(number => ({ number, ok: false, status: 'not configured' }))
  },
}
