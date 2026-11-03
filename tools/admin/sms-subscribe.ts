// SMS alert subscribers (technicaldoc §10): who gets a text when an alert is raised for a district.
// Numbers are personal data: add one only with the person's consent, recorded here, and remove
// it when asked. Clients cannot read or write sms_subscribers (infra/firestore.rules).
//
//   pnpm --filter @repo/admin-tools sms-subscribe add --phone +260971234567 --district Chongwe
//        --consent "verbal, demo briefing 30 Oct" [--label "Judge 1"]
//   pnpm --filter @repo/admin-tools sms-subscribe add --phone +260971234567 --district all ...
//   pnpm --filter @repo/admin-tools sms-subscribe remove --phone +260971234567 [--district Chongwe]
//   pnpm --filter @repo/admin-tools sms-subscribe list
//
// --district all subscribes the number to every district's alerts (the presenter's phone).
import { districtSlug, findDistrict } from '@repo/shared'
import { ACCOUNT, commit, FsTimestamp, listDocuments, type Write } from '@repo/tools-gcp'

const [command, ...rest] = process.argv.slice(2).filter(arg => arg !== '--')
const flags = new Map<string, string>()
for (let i = 0; i < rest.length; i += 2) {
  if (!rest[i].startsWith('--') || rest[i + 1] === undefined)
    throw new Error(`Expected --name value, got ${rest[i]}`)
  flags.set(rest[i].slice(2), rest[i + 1])
}

const E164 = /^\+[1-9]\d{7,14}$/
const mask = (phone: string) => `${phone.slice(0, 6)}***${phone.slice(-3)}`

function phoneFlag() {
  const phone = (flags.get('phone') ?? '').replace(/[\s-]/g, '')
  if (!E164.test(phone)) throw new Error('--phone must be E.164, e.g. +260971234567')
  if (!phone.startsWith('+260')) console.warn(`Note: ${mask(phone)} is not a Zambian number.`)
  return phone
}

function districtFlag() {
  const value = flags.get('district')
  if (!value) return null
  if (value === 'all' || value === '*') return '*'
  const district = findDistrict(value)
  if (!district) throw new Error(`Unknown district ${value}`)
  return districtSlug(district.name)
}

const docId = (phone: string, slug: string) => `${phone.slice(1)}_${slug === '*' ? 'all' : slug}`

if (command === 'add') {
  const phone = phoneFlag()
  const slug = districtFlag()
  const consent = flags.get('consent')
  if (!slug) throw new Error('--district <name|all> is required')
  if (!consent || consent.length < 5)
    throw new Error('--consent "<how and when consent was given>" is required')
  const now = new FsTimestamp(new Date().toISOString())
  await commit([
    {
      set: `sms_subscribers/${docId(phone, slug)}`,
      data: {
        phone,
        district_slug: slug,
        active: true,
        label: flags.get('label') ?? null,
        consent: { note: consent, recorded_by: ACCOUNT, recorded_at: now },
        created_at: now,
      },
    },
  ])
  console.log(`Subscribed ${mask(phone)} to ${slug === '*' ? 'every district' : slug}.`)
} else if (command === 'remove') {
  const phone = phoneFlag()
  const slug = districtFlag()
  const writes: Write[] = (await listDocuments('sms_subscribers'))
    .filter(d => d.data.phone === phone && (!slug || d.data.district_slug === slug))
    .map(d => ({ delete: d.path }))
  await commit(writes)
  console.log(`Removed ${writes.length} subscription(s) for ${mask(phone)}.`)
} else if (command === 'list') {
  const docs = await listDocuments('sms_subscribers')
  for (const { data } of docs) {
    const district = data.district_slug === '*' ? 'all' : String(data.district_slug)
    console.log(
      `  ${mask(String(data.phone))}  ${district.padEnd(16)} ${data.active ? 'active' : 'inactive'}  ${data.label ?? ''}`
    )
  }
  console.log(`${docs.length} subscription(s).`)
} else {
  throw new Error(
    'usage: sms-subscribe add|remove|list (see the header of tools/admin/sms-subscribe.ts)'
  )
}
