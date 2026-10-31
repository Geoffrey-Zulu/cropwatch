// The CEIH backup recording (docs/ceih-overnight-plan.md §4, Phase 4): the dashboard-only
// storyline played on a deployed dashboard from a clean browser profile at projector size, as
// one continuous video, a take a beat cut from it (needs ffmpeg on the PATH) and a screenshot a
// beat. It opens on the Fields map, then cuts to the Season ledger. It moves the season (a ground
// check, Given's advance, March and June), so re-arm the season afterwards: `seed --ceih … --commit`.
//
//   PHYTOS_RECORD_EMAIL=… PHYTOS_RECORD_PASSWORD=… pnpm --filter @repo/visual record-ceih \
//        --out <folder> [--dashboard https://…web.app] [--size 1280x800]
import { execFileSync } from 'node:child_process'
import { mkdirSync, renameSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium, type Page } from 'playwright'

const args = process.argv.slice(2).filter(arg => arg !== '--')
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const out = resolve(process.env.INIT_CWD ?? process.cwd(), flag('out') ?? 'ceih-recording')
const base = flag('dashboard') ?? 'https://crop-watch01.web.app'
const [width, height] = (flag('size') ?? '1280x800').split('x').map(Number)
const email = process.env.PHYTOS_RECORD_EMAIL
const password = process.env.PHYTOS_RECORD_PASSWORD
if (!email || !password) throw new Error('Set PHYTOS_RECORD_EMAIL and PHYTOS_RECORD_PASSWORD')
mkdirSync(join(out, '.raw'), { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
// A clean profile: a new context, no storage carried over.
const context = await browser.newContext({
  viewport: { width, height },
  recordVideo: { dir: join(out, '.raw'), size: { width, height } },
})
const page = await context.newPage()
// The video starts with the page: beat offsets from here cut the takes.
const t0 = Date.now()
const takes: { name: string; from: number; to: number }[] = []
const errors: string[] = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => {
  if (m.type() === 'error' && !m.location().url.includes('firebasestorage'))
    errors.push(m.text().slice(0, 200))
})
const timings: string[] = []
// A beat: do it, time it, let the room read it, take its picture.
async function beat(name: string, work: (p: Page) => Promise<void>, hold = 3500) {
  const t = Date.now()
  await work(page)
  timings.push(`${name}: ${((Date.now() - t) / 1000).toFixed(1)} s`)
  await page.waitForTimeout(hold)
  await page.screenshot({ path: join(out, `${name}.png`) })
  takes.push({ name, from: (t - t0) / 1000, to: (Date.now() - t0) / 1000 })
}
// Put an element near the top of the screen, under the header, so its whole island shows.
async function frame(p: Page, target: ReturnType<Page['locator']>) {
  const box = await target.boundingBox()
  if (box) await p.evaluate(y => window.scrollBy(0, y - 110), box.y)
}
const controls = async (p: Page) => {
  if (!(await p.getByRole('button', { name: /Go to June/ }).isVisible()))
    await p.getByText('DEMO CONTROLS').click()
}

await page.goto(base)
await page.locator('input[type=email]').fill(email)
await page.locator('input[type=password]').fill(password)
await page.getByRole('button', { name: 'Sign in' }).click()
await page.getByRole('heading', { name: 'National map' }).waitFor({ timeout: 30_000 })

await beat(
  '1a-fields-map',
  async p => {
    // The pointer off the map, so no field's tooltip sits in the opening shot.
    await p.mouse.move(12, 140)
    await p.goto(`${base}/#/outgrower/fields`)
    await p.getByRole('heading', { name: 'Fields map' }).waitFor({ timeout: 30_000 })
    // Into Chikuni: the fields light up once the map lands.
    await p.locator('.fm-lit').waitFor({ timeout: 20_000 })
    await p
      .locator('.leaflet-tile-loaded')
      .first()
      .waitFor({ timeout: 20_000 })
      .catch(() => errors.push('no imagery tile loaded'))
  },
  5000
)
await beat('1b-season-ledger', async p => {
  await p.getByRole('tab', { name: 'Season ledger' }).click()
  await p.getByRole('heading', { name: 'Season ledger' }).waitFor({ timeout: 30_000 })
})
await beat('2-given-cloud-gap', async p => {
  await p
    .getByRole('row', { name: /Given Mweemba/ })
    .first()
    .click()
  await p.getByText('Greenness from space').waitFor({ timeout: 20_000 })
  await p.getByText('Greenness from space').scrollIntoViewIfNeeded()
})
await beat('3-ground-check-eligible', async p => {
  await controls(p)
  await p.getByRole('button', { name: /ground check lands/i }).click()
  await p.getByRole('button', { name: /Request advance for Given/ }).waitFor({ timeout: 20_000 })
  await p.getByRole('button', { name: /Request advance for Given/ }).scrollIntoViewIfNeeded()
})
await beat('4a-request-amount-and-fee', async p => {
  await p.getByRole('button', { name: /Request advance for Given/ }).click()
  await p.getByRole('dialog').waitFor()
})
await beat('4b-farmer-code', async p => {
  await p.getByRole('button', { name: 'Send to Given' }).click()
  await p.getByRole('button', { name: /Use the code from the SMS log/ }).click({ timeout: 20_000 })
})
await beat('4c-confirmed', async p => {
  await p.getByRole('button', { name: 'Confirm' }).click()
  await p.getByText('Confirmed by the farmer').waitFor({ timeout: 20_000 })
})
await beat('5-approval-card', async p => {
  await p.getByRole('link', { name: 'Open approvals' }).click()
  await p.getByRole('button', { name: 'Approve ZMW 840' }).first().waitFor({ timeout: 20_000 })
  await p.getByRole('button', { name: 'Approve ZMW 840' }).first().scrollIntoViewIfNeeded()
})
await beat('6a-approve', async p => {
  await p.getByRole('button', { name: 'Approve ZMW 840' }).first().click()
  await p.getByRole('dialog').waitFor()
})
await beat('6b-sent', async p => {
  await p.getByRole('button', { name: 'Approve and send' }).click()
  await p.getByText('ZMW 840 sent').waitFor({ timeout: 30_000 })
})
await beat('6c-sms-log', async p => {
  await p.getByRole('button', { name: 'Done' }).click()
  await p
    .getByText(/ZMW 840 sent to your Airtel Money/)
    .first()
    .waitFor({ timeout: 20_000 })
  await frame(p, p.getByRole('heading', { name: 'SMS log' }))
})
await beat('7-march-drought', async p => {
  await controls(p)
  await p.getByRole('button', { name: /Go to March/ }).click()
  await p.getByText('Mar 2027').first().waitFor({ timeout: 30_000 })
  await p.goto(`${base}/#/outgrower/reconciliation`)
  await p
    .getByText(/drought trigger/)
    .first()
    .waitFor({ timeout: 30_000 })
  await frame(p, p.getByText('Hamangaba', { exact: true }).first())
})
await beat(
  '8-june-statement',
  async p => {
    await controls(p)
    await p.getByRole('button', { name: /Go to June/ }).click()
    await p.getByText('Jun 2027').first().waitFor({ timeout: 30_000 })
    await p.getByRole('button', { name: 'Record delivery' }).click()
    await p.getByText('Net due to Given').waitFor({ timeout: 30_000 })
    await p.getByText('Net due to Given').scrollIntoViewIfNeeded()
  },
  5000
)

const video = page.video()
await context.close()
const full = join(out, 'ceih-storyline.webm')
if (video) renameSync(await video.path(), full)
await browser.close()
// A take a beat, as MP4 (plays anywhere), and the continuous run as MP4 too.
const ffmpeg = (...a: string[]) =>
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: 'inherit' })
const mp4 = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '20', '-an']
try {
  mkdirSync(join(out, 'takes'), { recursive: true })
  ffmpeg('-i', full, ...mp4, join(out, 'ceih-storyline.mp4'))
  for (const take of takes) {
    const from = Math.max(0, take.from - 0.3).toFixed(2)
    ffmpeg(
      '-ss',
      from,
      '-to',
      take.to.toFixed(2),
      '-i',
      full,
      ...mp4,
      join(out, 'takes', `${take.name}.mp4`)
    )
  }
  console.log(`cut ${takes.length} takes into ${join(out, 'takes')}`)
} catch (e) {
  console.log(`takes not cut (ffmpeg): ${(e as Error).message.slice(0, 200)}`)
}
console.log(timings.join('\n'))
console.log(`saved ceih-storyline.webm and .mp4 and a screenshot a beat in ${out}`)
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors')
