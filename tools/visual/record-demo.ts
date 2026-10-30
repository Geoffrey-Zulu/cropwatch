// The backup recordings (docs/demo-ops.md, "Backup recordings of every step"), made from one
// genuine run on the live system: a real report sent from the capture app at the venue pin
// (phone size), the dashboard (laptop size) watching it land, an officer verifying it, then the
// Outgrower View and the report's own drawer. One video a step. The report is real, so undo it
// afterwards: pnpm --filter @repo/admin-tools retract-report --obs <id> --commit
//
//   PHYTOS_RECORD_EMAIL=… PHYTOS_RECORD_PASSWORD=… pnpm --filter @repo/visual record-demo \
//     --out <folder> --photo <leaf-mines.jpg> [--center -15.388311,28.346069] [--district Lusaka]
//
// Not recordable here: the SMS on a phone (recording 3 needs the phone itself).
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium, type BrowserContext, type Page } from 'playwright'

const args = process.argv.slice(2).filter(arg => arg !== '--')
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const root = process.env.INIT_CWD ?? process.cwd()
const out = resolve(root, flag('out') ?? 'recordings')
const photo = flag('photo') ? resolve(root, flag('photo')!) : null
const [lat, lon] = (flag('center') ?? '-15.388311,28.346069').split(',').map(Number)
const district = flag('district') ?? 'Lusaka'
const email = process.env.PHYTOS_RECORD_EMAIL
const password = process.env.PHYTOS_RECORD_PASSWORD
if (!photo || !email || !password)
  throw new Error(
    'needs --photo and PHYTOS_RECORD_EMAIL / PHYTOS_RECORD_PASSWORD in the environment'
  )

const DASHBOARD = 'https://crop-watch01.web.app'
const CAPTURE = 'https://crop-watch01-capture.web.app'
const LAPTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
mkdirSync(out, { recursive: true })
const log: string[] = []
const note = (line: string) => {
  const stamped = `${new Date().toISOString().slice(11, 19)}  ${line}`
  log.push(stamped)
  console.log(stamped)
}
const pause = (page: Page, ms: number) => page.waitForTimeout(ms)

// Scroll a page, or a scrolling element inside it, slowly enough to read on playback.
async function glide(page: Page, distance: number, selector?: string) {
  if (selector) await page.hover(selector)
  for (let moved = 0; moved < distance; moved += 120) {
    await page.mouse.wheel(0, 120)
    await pause(page, 260)
  }
}

// Each step is its own page, so each gets its own video, saved under the step's name.
async function step(context: BrowserContext, name: string, run: (page: Page) => Promise<void>) {
  const page = await context.newPage()
  note(`start ${name}`)
  try {
    await run(page)
  } finally {
    const video = page.video()
    await page.close()
    if (video) renameSync(await video.path(), join(out, `${name}.webm`))
    note(`saved ${name}.webm`)
  }
}

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
})
const dashboard = await browser.newContext({
  viewport: LAPTOP,
  recordVideo: { dir: join(out, '.raw'), size: LAPTOP },
})
const capture = await browser.newContext({
  viewport: PHONE,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  // About 1 km from the venue, as outbreak-e2e places its report.
  geolocation: { latitude: lat + 0.006, longitude: lon + 0.006 },
  permissions: ['geolocation', 'camera'],
  recordVideo: { dir: join(out, '.raw'), size: PHONE },
})

// Sign in and leave the laptop as the pre-stage does: queue on "In a cluster, not verified",
// national map, focus on Lusaka and Chongwe, bell drawer closed.
const signIn = await dashboard.newPage()
await signIn.goto(DASHBOARD)
await signIn.locator('input[type=email]').fill(email)
await signIn.locator('input[type=password]').fill(password)
await signIn.getByRole('button', { name: 'Sign in' }).click()
await signIn.getByRole('heading', { name: 'National map' }).waitFor({ timeout: 30_000 })
await signIn.evaluate(() => localStorage.setItem('phytos.queue-tab', 'cluster'))
note(`signed in as ${email}`)

const bellCount = async (page: Page) => {
  const label = (await page.locator('a[aria-label^="Alerts"]').getAttribute('aria-label')) ?? ''
  return Number(/(\d+)/.exec(label)?.[1] ?? 0)
}

// Recording 2 runs while recording 1 happens: the map is watching when the report is sent.
const mapPage = await dashboard.newPage()
note('start 2-dashboard-report-lands')
await mapPage.goto(DASHBOARD)
await mapPage.getByRole('heading', { name: 'National map' }).waitFor()
await mapPage.getByRole('button', { name: 'Lusaka and Chongwe' }).click()
await pause(mapPage, 3000)
const alertsBefore = await bellCount(mapPage)

let obsId = ''
await step(capture, '1-capture-report-and-advice', async page => {
  await page.goto(CAPTURE)
  await pause(page, 3500)
  await page.locator('input[type=file]:not([capture])').setInputFiles(photo)
  await pause(page, 1500)
  await page.locator('input[value="tomato"]').check({ force: true })
  await pause(page, 1000)
  const chosen = await page.locator('#district').inputValue()
  if (!chosen) await page.locator('#district').selectOption(district)
  await pause(page, 1000)
  const notes = page.locator('textarea')
  if (await notes.count())
    await notes.first().pressSequentially('White mines in the leaves, small holes in the fruit', {
      delay: 40,
    })
  await pause(page, 800)
  await page.getByRole('button', { name: 'Send report' }).click()
  note('report sent')
  await page.waitForURL(/#\/(sent|report)\//, { timeout: 60_000 })
  obsId = /#\/(?:sent|report)\/([^/?]+)/.exec(page.url())?.[1] ?? ''
  note(`report id ${obsId}`)
  await page.waitForURL(/#\/report\//, { timeout: 30_000 })
  // The diagnosis and the advice ladder, or the officer hand-off.
  await page
    .getByText(/What to do|extension officer|officer will look/i)
    .first()
    .waitFor({ timeout: 90_000 })
  note('result on the phone')
  // Hold on the diagnosis, then read down the advice ladder.
  await pause(page, 5000)
  await glide(page, 600)
  await pause(page, 2500)
  await glide(page, 1000)
  await pause(page, 3000)
})

// Back on the map: the cluster ring, the district, then the new alert behind the bell.
const deadline = Date.now() + 60_000
while (Date.now() < deadline && (await bellCount(mapPage)) <= alertsBefore)
  await pause(mapPage, 1000)
note(`alert on the dashboard (bell ${alertsBefore} → ${await bellCount(mapPage)})`)
await pause(mapPage, 5000)
await mapPage.locator('a[aria-label^="Alerts"]').click()
await pause(mapPage, 6000)
await mapPage.keyboard.press('Escape')
await pause(mapPage, 1500)
{
  const video = mapPage.video()
  await mapPage.close()
  if (video) renameSync(await video.path(), join(out, '2-dashboard-report-lands.webm'))
  note('saved 2-dashboard-report-lands.webm')
}

const reportNumber = obsId.slice(0, 4).toUpperCase()
await step(dashboard, '4-queue-verify-and-upgrade', async page => {
  await page.goto(`${DASHBOARD}/#/queue`)
  await page.getByRole('heading', { name: 'Officer queue' }).waitFor()
  await pause(page, 2500)
  let row = page.getByRole('link', { name: new RegExp(reportNumber) }).first()
  if (!(await row.count())) {
    await page.getByRole('tab', { name: /Routed to an officer/ }).click()
    await pause(page, 1500)
    row = page.getByRole('link', { name: new RegExp(reportNumber) }).first()
  }
  await row.click()
  await pause(page, 3000)
  const before = await page
    .locator('[aria-label$="verified observations"]')
    .getAttribute('aria-label')
  const confirm = page.getByRole('radio', { name: /Confirm the AI assessment/ })
  if (await confirm.count()) await confirm.check()
  else await page.getByRole('combobox', { name: 'Issue' }).selectOption('tuta_absoluta')
  await pause(page, 1200)
  await page.getByRole('button', { name: /Verify in the field|Confirm as an expert/ }).click()
  await page.getByText(/^Verified as /).waitFor({ timeout: 30_000 })
  note('verified by the officer')
  await pause(page, 4000)
  const after = await page
    .locator('[aria-label$="verified observations"]')
    .getAttribute('aria-label')
  note(`counter ${before} → ${after}`)
  // The venue's own alert row, not any verified alert: other districts already have one.
  await page.locator('a[aria-label^="Alerts"]').click()
  const venueAlert = page
    .getByRole('dialog')
    .getByRole('link')
    .filter({ hasText: `· ${district}` })
    .filter({ hasText: /Tuta absoluta/ })
    .first()
  await venueAlert.waitFor({ timeout: 30_000 })
  await venueAlert.scrollIntoViewIfNeeded()
  await pause(page, 2000)
  try {
    await venueAlert.filter({ hasText: 'Verified cluster alert' }).waitFor({ timeout: 45_000 })
    note('the venue alert now reads "Verified cluster alert"')
  } catch {
    note('the venue alert did NOT turn into a verified cluster alert within 45 s')
  }
  await pause(page, 6000)
  await page.keyboard.press('Escape')
  await pause(page, 1500)
})

await step(dashboard, '5-outgrower-view', async page => {
  await page.goto(`${DASHBOARD}/#/outgrower`)
  await page.getByText('Camps needing attention').waitFor({ timeout: 30_000 })
  await pause(page, 4000)
  await glide(page, 500)
  await pause(page, 1500)
  await page.getByRole('button', { name: /Prioritise field officers/ }).click()
  await pause(page, 3000)
  await page.getByRole('link', { name: /View/ }).first().click()
  await pause(page, 6000)
  await page.keyboard.press('Escape')
  await pause(page, 1500)
})

await step(dashboard, '6-report-drawer-why-this-advice', async page => {
  await page.goto(`${DASHBOARD}/#/queue/${obsId}?observation=${obsId}`)
  await page.getByRole('dialog').waitFor({ timeout: 30_000 })
  await pause(page, 4000)
  await glide(page, 700, '[role=dialog]')
  await pause(page, 1500)
  await page.getByText('Why this advice?').click()
  await pause(page, 3000)
  await glide(page, 1600, '[role=dialog]')
  await pause(page, 3000)
})

await signIn.close()
await dashboard.close()
await capture.close()
await browser.close()
writeFileSync(join(out, 'run-log.txt'), `${log.join('\n')}\n`)
console.log(
  `\nReport ${obsId}. Undo it: pnpm --filter @repo/admin-tools retract-report --obs ${obsId} --commit`
)
