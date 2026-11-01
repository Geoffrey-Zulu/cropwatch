// Overflow audit: every screen of both apps at seven widths, phone to wide laptop. Fails on a
// page that scrolls sideways, anything poking out of its island or dialog, a control whose label
// spills out of its pill, or a ZMW figure broken across lines.
//
//   pnpm --filter @repo/visual exec tsx overflow.ts [dashboard-preview-origin] [farmer-url]
// The dashboard runs from the dev preview (seed fixtures, no sign-in):
//   pnpm --filter @repo/seed exec tsx ceih-fixtures.ts, then the web dev server on 5173.
import { chromium, type Page } from 'playwright'

const origin = process.argv[2] ?? 'http://localhost:5173'
const farmerUrl = process.argv[3] ?? `${origin}/farmer.html`
const WIDTHS = [390, 600, 768, 1024, 1152, 1280, 1440]

type Step = { name: string; open: (page: Page) => Promise<void> }

const STEPS: Step[] = [
  { name: 'fields map', open: p => go(p, `${origin}/#/preview/fields`, 'Outgrower Co.') },
  {
    name: 'season ledger + field card',
    open: p => go(p, `${origin}/#/preview/season`, 'Season record'),
  },
  {
    name: 'loan check (verdict)',
    open: async p => {
      await go(p, `${origin}/#/preview/season`, 'Season record')
      await p.getByRole('button', { name: 'Run check' }).click()
      await p.getByRole('button', { name: 'Skip' }).click()
      await p.getByText('Rules, not a score: every one is above.').waitFor()
      await p.waitForTimeout(1300)
    },
  },
  {
    name: 'reconciliation',
    open: p => go(p, `${origin}/#/preview/reconciliation`, 'Start reconciliation'),
  },
  {
    name: 'reconciliation (run)',
    open: async p => {
      await go(p, `${origin}/#/preview/reconciliation`, 'Start reconciliation')
      const start = p.getByRole('button', { name: 'Start reconciliation' })
      if (!(await start.count())) return
      await start.click()
      const skip = p.getByRole('button', { name: 'Skip' })
      await p.waitForTimeout(1200)
      if (await skip.count()) await skip.first().click()
      await p.waitForTimeout(1500)
    },
  },
  { name: 'farmer app', open: p => go(p, farmerUrl, 'Check my advance') },
  {
    name: 'farmer app: the check',
    open: async p => {
      await go(p, farmerUrl, 'Check my advance')
      await p.getByRole('button', { name: 'Check my advance' }).click()
      await p.getByRole('button', { name: 'Skip' }).click()
      await p.waitForTimeout(1300)
    },
  },
  {
    name: 'farmer app: sent',
    open: async p => {
      await go(p, farmerUrl, 'Check my advance')
      await p.getByRole('button', { name: 'Check my advance' }).click()
      await p.getByRole('button', { name: 'Skip' }).click()
      await p.getByText('sent to your registered mobile money account').waitFor({ timeout: 15_000 })
      await p.waitForTimeout(900)
    },
  },
  {
    name: 'farmer app: after',
    open: async p => {
      await go(p, farmerUrl, 'Check my advance')
      await p.getByRole('button', { name: 'Check my advance' }).click()
      await p.getByRole('button', { name: 'Skip' }).click()
      await p.getByRole('button', { name: 'Done' }).click({ timeout: 15_000 })
      await p.waitForTimeout(700)
    },
  },
]

async function go(page: Page, url: string, text: string) {
  await page.goto('about:blank')
  await page.goto(url)
  await page
    .locator(`:is(h1, h2, h3, button):has-text("${text}"):visible`)
    .first()
    .waitFor({ timeout: 20_000 })
  await page.waitForTimeout(1500)
}

// Runs in the page, sent as source text (tsx adds helpers to compiled functions that the page
// does not have).
const AUDIT = `(() => {
  const issues = []
  const name = (el) =>
    '<' + el.tagName.toLowerCase() + '> "' + (el.textContent ?? '').trim().replace(/\\s+/g, ' ').slice(0, 48) + '"'
  const vw = window.innerWidth
  const sw = document.documentElement.scrollWidth
  if (sw > vw + 1) issues.push('the page scrolls sideways (' + sw + ' px in ' + vw + ')')
  for (const box of document.querySelectorAll('.island, [role="dialog"]')) {
    const b = box.getBoundingClientRect()
    if (!b.width) continue
    for (const el of box.querySelectorAll('*')) {
      if (el.closest('.leaflet-container')) continue
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      // Clipped by a scrolling parent, or a fixed layer (a dialog mounted inside an island): the
      // dialog is audited as its own box.
      let skip = getComputedStyle(el).position === 'fixed'
      for (let p = el.parentElement; p && p !== box; p = p.parentElement) {
        const cs = getComputedStyle(p)
        if (/auto|scroll|hidden|clip/.test(cs.overflowX) || cs.position === 'fixed') skip = true
      }
      if (skip) continue
      const out = Math.max(r.right - b.right, b.left - r.left)
      if (out > 1) issues.push(name(el) + ' pokes ' + Math.round(out) + ' px out of its box')
    }
  }
  for (const el of document.querySelectorAll('button, a[class*="btn-"], [role="combobox"]')) {
    const h = el
    if (!h.offsetParent) continue
    if (h.scrollHeight > h.clientHeight + 2) issues.push(name(el) + ': its label spills out')
    if (h.scrollWidth > h.clientWidth + 2) issues.push(name(el) + ': its label is cut')
  }
  for (const el of document.querySelectorAll('dd, td, [role="cell"], p, span')) {
    const text = (el.textContent ?? '').trim()
    if (!/^(less )?ZMW [\\d,]+$/.test(text) || el.children.length > 2) continue
    const range = document.createRange()
    range.selectNodeContents(el)
    const lines = new Set(
      [...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top / 4))
    )
    if (lines.size > 1) issues.push('"' + text + '" breaks across ' + lines.size + ' lines')
  }
  return [...new Set(issues)]
})()`

const browser = await chromium.launch({ channel: 'chrome' })
let failures = 0
for (const step of STEPS) {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    try {
      await step.open(page)
      const issues = [
        ...((await page.evaluate(AUDIT)) as string[]),
        ...errors.map(e => `page error: ${e}`),
      ]
      if (issues.length) {
        failures++
        console.log(`✗ ${step.name} @ ${width}:`)
        for (const issue of issues.slice(0, 12)) console.log(`    ${issue}`)
      } else console.log(`✓ ${step.name} @ ${width}`)
    } catch (error) {
      failures++
      console.log(
        `✗ ${step.name} @ ${width}: could not open (${(error as Error).message.split('\n')[0]})`
      )
    }
    await page.close()
  }
}
await browser.close()
console.log(failures ? `${failures} screen(s) overflow` : 'No overflow on any screen')
process.exit(failures ? 1 : 0)
