// The CEIH backup recording (1 Nov, the two-app storyline): the agribusiness app and the farmer
// app played on the deployed sites from a clean browser profile at projector size, as one
// continuous video (one tab: the farmer app is opened in place of the agribusiness app and back),
// a take a beat cut from it (needs ffmpeg on the PATH) and a screenshot a beat. It moves the live
// season (a ground check, June, the payout request), so re-arm afterwards: `seed --ceih … --commit`.
// The farmer app never touches the live season.
//
//   PHYTOS_RECORD_EMAIL=… PHYTOS_RECORD_PASSWORD=… pnpm --filter @repo/visual record-ceih \
//        --out <folder> [--dashboard https://…web.app] [--farmer https://…web.app] [--size 1280x800]
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
const farmer = flag('farmer') ?? 'https://crop-watch01-farmer.web.app'
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
// A slow venue or hotel line: the first load of a new build can take most of a minute.
page.setDefaultNavigationTimeout(120_000)
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
  try {
    await work(page)
  } catch (error) {
    // What the screen showed when a beat failed.
    await page.screenshot({ path: join(out, `FAILED-${name}.png`) }).catch(() => undefined)
    throw error
  }
  timings.push(`${name}: ${((Date.now() - t) / 1000).toFixed(1)} s`)
  await page.waitForTimeout(hold)
  await page.screenshot({ path: join(out, `${name}.png`) })
  takes.push({ name, from: (t - t0) / 1000, to: (Date.now() - t0) / 1000 })
}
// The season controls: a small unlabeled gear at the right of the tab bar (1 Nov).
const gear = (p: Page) => p.locator('summary[aria-label="Season controls"]')
const controls = async (p: Page) => {
  if (!(await p.getByRole('button', { name: /Go to June/ }).isVisible())) await gear(p).click()
}
const closeControls = async (p: Page) => {
  if (await p.getByRole('button', { name: /Go to June/ }).isVisible()) await gear(p).click()
}

await page.goto(base)
await page.locator('input[type=email]').fill(email)
await page.locator('input[type=password]').fill(password)
await page.getByRole('button', { name: 'Sign in' }).click()
// Sign-in lands on the Fields map (1 Nov: three screens and the farmer app).
await page.getByRole('heading', { name: 'Fields map' }).waitFor({ timeout: 60_000 })

await beat(
  '1a-fields-map',
  async p => {
    // The pointer off the map, so no field's tooltip sits in the opening shot.
    await p.mouse.move(12, 140)
    await p.goto(`${base}/#/outgrower/fields`)
    await p.getByRole('heading', { name: 'Fields map' }).waitFor({ timeout: 90_000 })
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
  await p.getByRole('link', { name: 'Season ledger', exact: true }).click()
  await p.getByRole('heading', { name: 'Season ledger' }).waitFor({ timeout: 30_000 })
})
await beat('2-given-cloud-gap', async p => {
  await p
    .getByRole('row', { name: /Given Mweemba/ })
    .first()
    .click()
  await p.getByText('Greenness from space').waitFor({ timeout: 20_000 })
  // The opened row rises under the header by itself; let it land.
  await p.waitForTimeout(700)
})
await beat('3a-ground-check-lands', async p => {
  await controls(p)
  await p.getByRole('button', { name: /ground check lands/i }).click()
  await p.getByText(/an advance is sent automatically when Given asks/).waitFor({ timeout: 20_000 })
  await closeControls(p)
})
await beat(
  '3b-loan-check',
  async p => {
    // The hunger-month loan check, played: a frame in each of its four stages.
    await p.getByRole('button', { name: 'Run check' }).first().click()
    const dialog = p.getByRole('dialog', { name: 'Given Mweemba' })
    await dialog.waitFor({ timeout: 10_000 })
    for (const [ms, name] of [
      [2600, '3b1-check-field'],
      [3600, '3b2-check-passes'],
      [3600, '3b3-check-rules'],
    ] as const) {
      await p.waitForTimeout(ms)
      await p.screenshot({ path: join(out, `${name}.png`) })
    }
    await dialog.getByText('Rules, not a score: every one is above.').waitFor({ timeout: 15_000 })
  },
  4000
)
await beat('4a-farmer-app', async p => {
  // Given's phone: the farmer app, in the second tab (here, in place of the first).
  await p.keyboard.press('Escape')
  await p.goto(farmer)
  await p.getByRole('button', { name: 'Check my advance' }).waitFor({ timeout: 60_000 })
  await p.waitForTimeout(800)
})
await beat(
  '4b-farmer-check-and-money',
  async p => {
    await p.getByRole('button', { name: 'Check my advance' }).click()
    await p.waitForTimeout(5000)
    await p.screenshot({ path: join(out, '4b1-farmer-passes.png') })
    // The verdict: whether and how much; then he takes it.
    await p.getByRole('button', { name: 'Get advance' }).waitFor({ timeout: 20_000 })
    await p.waitForTimeout(2500)
    await p.screenshot({ path: join(out, '4b2-farmer-verdict.png') })
    await p.getByRole('button', { name: 'Get advance' }).click()
    await p.waitForTimeout(1200)
    await p.screenshot({ path: join(out, '4b3-farmer-sending.png') })
    await p.getByText('sent to your registered mobile money account').waitFor({ timeout: 20_000 })
  },
  4500
)
await beat('4c-farmer-statement', async p => {
  await p.getByRole('button', { name: 'Done' }).click()
  await p.getByText('Advance sent').waitFor({ timeout: 10_000 })
})
await beat('5a-reconciliation', async p => {
  // Back to the agribusiness, still in January: Reconciliation.
  await p.goto(`${base}/#/outgrower/reconciliation`)
  await p.getByRole('button', { name: 'Start reconciliation' }).waitFor({ timeout: 60_000 })
  await p.getByText('Moves the season to June').waitFor({ timeout: 30_000 })
})
await beat(
  '5b-june-and-batch',
  async p => {
    // One press: the season moves to June, then the batch plays.
    await p.getByRole('button', { name: 'Start reconciliation' }).click()
    // The season line, not the closed gear panel's copy of the date.
    await p.locator(':text("Jun 2027"):visible').first().waitFor({ timeout: 30_000 })
    await p.waitForTimeout(4500)
    await p.screenshot({ path: join(out, '5b1-batch-playing.png') })
    await p.getByRole('button', { name: 'Request bulk payment' }).waitFor({ timeout: 30_000 })
  },
  5000
)
await beat('6a-payout-confirm', async p => {
  await p.getByRole('button', { name: 'Request bulk payment' }).click()
  await p.getByRole('button', { name: 'Send bulk payment' }).waitFor({ timeout: 10_000 })
})
await beat(
  '6b-payout-sent',
  async p => {
    await p.getByRole('button', { name: 'Send bulk payment' }).click()
    await p.getByText('Bulk payment request sent to Phytos').waitFor({ timeout: 30_000 })
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
