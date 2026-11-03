// The farmer app, played and photographed: boot, "Check my advance", the check, the money, the
// dashboard after. One run per viewport; prints the time from the press to "sent".
//
//   pnpm --filter @repo/visual exec tsx farmer-shot.ts [url] [outdir]
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:5173/farmer.html'
const out = process.argv[3] ?? 'shots/farmer'
mkdirSync(out, { recursive: true })

const VIEWPORTS = [
  { name: 'projector-1280', width: 1280, height: 800 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
]

const browser = await chromium.launch({ channel: 'chrome' })
for (const v of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: v.width, height: v.height } })
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Check my advance' }).waitFor()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${out}/farmer-1-boot-${v.name}.png` })
  const t0 = Date.now()
  await page.getByRole('button', { name: 'Check my advance' }).click()
  await page.waitForTimeout(5200)
  await page.screenshot({ path: `${out}/farmer-2-check-${v.name}.png` })
  await page.getByRole('button', { name: 'Get advance' }).waitFor({ timeout: 20_000 })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${out}/farmer-3-verdict-${v.name}.png` })
  await page.getByRole('button', { name: 'Get advance' }).click()
  await page.getByText('Within your cap: sending').waitFor({ timeout: 10_000 })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${out}/farmer-4-sending-${v.name}.png` })
  await page.getByText('sent to your registered mobile money account').waitFor({ timeout: 10_000 })
  const sent = (Date.now() - t0) / 1000
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${out}/farmer-5-sent-${v.name}.png` })
  await page.getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${out}/farmer-6-after-${v.name}.png` })
  await page.screenshot({ path: `${out}/farmer-7-after-full-${v.name}.png`, fullPage: true })
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  console.log(
    `${v.name}: press to sent ${sent.toFixed(1)} s · page errors ${errors.length}${errors.length ? ` (${errors.join('; ')})` : ''} · sideways scroll ${wide}`
  )
  await page.close()
}
await browser.close()
