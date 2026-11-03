import { describe, it, expect, vi } from 'vitest'
import { AlertPushDataSchema, type Alert } from '@repo/shared'
import { africasTalking, smsLogOnly } from './sms'
import { pushCopy, pushData, smsCopy } from './templates'

const alert: Alert = {
  type: 'cluster',
  issue: 'tuta_absoluta',
  district: 'Chongwe',
  district_slug: 'chongwe',
  geo_center: { latitude: -15.33, longitude: 28.68 },
  radius_km: 10,
  level: 'ELEVATED',
  contributing_factors: [
    'Cluster of 5 Tuta absoluta reports within 10 km (5 new in 24 h)',
    '9 reports this week (+125% on last week)',
  ],
  observation_ids: ['a', 'b', 'c', 'd', 'e'],
  channels_sent: [],
  created_at: '2026-10-26T09:00:00.000Z',
  sim: false,
}

describe('alert copy', () => {
  it('names level, problem and place, with the factors, and no numbers that read as odds', () => {
    const { title, body } = pushCopy(alert)
    expect(title).toBe('Watch: Tuta absoluta (tomato leafminer) near Chongwe')
    expect(body).toContain('Cluster of 5 Tuta absoluta reports within 10 km')
    for (const text of [title, body, smsCopy(alert)]) {
      expect(text).not.toMatch(/probab|likel|chance|confidence/i)
    }
  })

  it('labels simulated alerts as demo on every channel', () => {
    const sim = { ...alert, sim: true }
    expect(pushCopy(sim).title).toMatch(/^DEMO · /)
    expect(smsCopy(sim)).toMatch(/^Phytos DEMO alert/)
    expect(pushData('x', sim).sim).toBe('true')
  })

  it('says what the alert rests on and how sure it is, with no em dashes', () => {
    const unverified = pushCopy(alert)
    expect(unverified.body).toMatch(/^Model risk signal\./)
    expect(unverified.body).toContain('Not yet verified by an officer')
    expect(smsCopy(alert)).toContain('Not yet verified by an officer.')

    const verified = { ...alert, alert_class: 'verified_cluster' as const, verified_reports: 2 }
    expect(pushCopy(verified).body).toContain('2 of 5 reports verified by an officer')
    expect(smsCopy(verified)).toContain('Verified by an officer.')

    for (const a of [alert, verified]) {
      for (const text of [pushCopy(a).title, pushCopy(a).body, smsCopy(a)]) {
        expect(text).not.toContain('—')
      }
    }
  })

  it('keeps the SMS short: the leading factor only, no links', () => {
    const sms = smsCopy(alert)
    expect(sms).toContain(alert.contributing_factors[0])
    expect(sms).not.toContain(alert.contributing_factors[1])
    expect(sms).not.toMatch(/https?:/)
    expect(sms.length).toBeLessThanOrEqual(306)
  })

  it('builds the frozen push data payload', () => {
    expect(AlertPushDataSchema.parse(pushData('alert1', alert))).toMatchObject({
      alert_id: 'alert1',
      level: 'ELEVATED',
      district_slug: 'chongwe',
      sim: 'false',
    })
  })
})

describe("Africa's Talking", () => {
  const reply = (body: unknown, status = 201) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status }))

  it('posts a form to the sandbox with the API key header', async () => {
    const fetchImpl = reply({
      SMSMessageData: {
        Recipients: [
          { number: '+260971000001', status: 'Success', statusCode: 101 },
          { number: '+260961000002', status: 'InvalidPhoneNumber', statusCode: 403 },
        ],
      },
    })
    const sender = africasTalking({ username: 'sandbox', apiKey: 'k', sandbox: true, fetchImpl })
    const results = await sender.send(['+260971000001', '+260961000002'], 'hello')
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.sandbox.africastalking.com/version1/messaging')
    expect((init.headers as Record<string, string>).apiKey).toBe('k')
    const form = init.body as URLSearchParams
    expect(form.get('username')).toBe('sandbox')
    expect(form.get('to')).toBe('+260971000001,+260961000002')
    expect(form.get('message')).toBe('hello')
    expect(form.has('from')).toBe(false)
    expect(results).toEqual([
      { number: '+260971000001', ok: true, status: 'Success' },
      { number: '+260961000002', ok: false, status: 'InvalidPhoneNumber' },
    ])
  })

  it('uses the live endpoint and sender ID when given', async () => {
    const fetchImpl = reply({ SMSMessageData: { Recipients: [] } })
    const sender = africasTalking({
      username: 'cropwatch',
      apiKey: 'k',
      from: 'CROPWATCH',
      sandbox: false,
      fetchImpl,
    })
    await sender.send(['+260971000001'], 'hello')
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.africastalking.com/version1/messaging')
    expect((init.body as URLSearchParams).get('from')).toBe('CROPWATCH')
  })

  it('sends nothing to nobody, and throws on an HTTP error', async () => {
    const fetchImpl = reply('The supplied authentication is invalid', 401)
    const sender = africasTalking({ username: 'sandbox', apiKey: 'bad', sandbox: true, fetchImpl })
    expect(await sender.send([], 'hello')).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
    await expect(sender.send(['+260971000001'], 'hello')).rejects.toThrow(/HTTP 401/)
  })
})

describe('log-only SMS', () => {
  it('reports every number as not sent', async () => {
    expect(await smsLogOnly.send(['+260971000001'], 'hello')).toEqual([
      { number: '+260971000001', ok: false, status: 'not configured' },
    ])
  })
})
