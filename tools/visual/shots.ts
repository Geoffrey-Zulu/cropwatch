// The visual pass (docs/demo-ops.md, "Quality gate"): screenshots every Command Center and
// capture view at laptop and phone widths from the dev previews, and runs the checks a person
// would otherwise have to catch by eye. Every shot is still looked at before a tag.
//
//   pnpm --filter web dev        (VITE_FEATURE_SCENARIO=true, port 5173)
//   pnpm --filter capture dev    (port 5174)
//   pnpm --filter @repo/visual shots --out docs/ui-review/<name> [--photo leaf.jpg] [--only map,queue]
//
// Uses the installed Chrome (no browser download). The previews render from seed fixtures with
// the API mocked, so a pass needs no sign-in and touches no live data.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, type Page } from 'playwright'

const args = process.argv.slice(2).filter(arg => arg !== '--')
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const root = process.env.INIT_CWD ?? process.cwd()
const out = resolve(root, flag('out') ?? 'visual-out')
const dashboard = flag('dashboard') ?? 'http://localhost:5173'
const capture = flag('capture') ?? 'http://localhost:5174'
const photo = flag('photo') ? resolve(root, flag('photo')!) : null
const only = flag('only')?.split(',')

interface View {
  name: string
  app: 'dashboard' | 'capture'
  route: string
  prepare?: (page: Page) => Promise<void>
}

const VIEWS: View[] = [
  { name: 'capture-1-camera', app: 'capture', route: 'diagnose' },
  {
    name: 'capture-2-diagnose-ready',
    app: 'capture',
    route: 'diagnose',
    prepare: async page => {
      if (photo) await page.locator('input[type=file]:not([capture])').setInputFiles(photo)
      await page.locator('input[value="tomato"]').check({ force: true })
      await page.locator('#district').selectOption('Chongwe')
      await page.waitForTimeout(800)
    },
  },
  { name: 'capture-3-report-sent', app: 'capture', route: 'sent' },
  { name: 'capture-4-result-advice', app: 'capture', route: 'result' },
  { name: 'capture-5-result-officer', app: 'capture', route: 'officer' },
  { name: 'capture-6-home-alerts', app: 'capture', route: 'home' },
  { name: 'dashboard-map', app: 'dashboard', route: 'map' },
  { name: 'dashboard-alerts', app: 'dashboard', route: 'alerts' },
  { name: 'dashboard-outbreak', app: 'dashboard', route: 'outbreak' },
  { name: 'dashboard-observation', app: 'dashboard', route: 'observation' },
  { name: 'dashboard-queue', app: 'dashboard', route: 'queue' },
  {
    name: 'dashboard-outgrower',
    app: 'dashboard',
    route: 'outgrower',
    // As in the demo: the visit lists appear on "Prioritise field officers".
    prepare: async page => {
      await page.getByRole('button', { name: /prioritise field officers/i }).click()
      await page.waitForTimeout(500)
    },
  },
  { name: 'dashboard-visit', app: 'dashboard', route: 'visit' },
  { name: 'dashboard-sources', app: 'dashboard', route: 'sources' },
  { name: 'dashboard-scenario', app: 'dashboard', route: 'scenario' },
  {
    name: 'dashboard-scenario-dry',
    app: 'dashboard',
    route: 'scenario',
    prepare: async page => {
      await page.getByRole('switch').click()
      await page.waitForTimeout(600)
    },
  },
]

const WIDTHS = [
  { label: 'laptop', width: 1440, height: 900 },
  { label: 'phone', width: 390, height: 844 },
]

// What a person would catch by eye, measured: page overflow, clipped text, and parts of a
// control drawn outside the control (the scenario toggle's knob on 29 Oct).
async function check(page: Page, width: number) {
  return page.evaluate(w => {
    const issues: string[] = []
    const scrollWidth = document.documentElement.scrollWidth
    if (scrollWidth > w + 1) issues.push(`page scrolls sideways: ${scrollWidth} px wide`)
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''} "${(el.textContent ?? '').trim().slice(0, 40)}"`
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      if (el.closest('svg') || el.closest('[data-visual-scroll]')) continue
      // Screen-reader-only text is clipped on purpose.
      if (el.getBoundingClientRect().width <= 1 || style.clip === 'rect(0px, 0px, 0px, 0px)')
        continue
      const text = (el.textContent ?? '').trim()
      if (
        text &&
        el.children.length === 0 &&
        (style.textOverflow === 'ellipsis' || style.overflowX === 'hidden') &&
        el.scrollWidth > el.clientWidth + 1
      )
        issues.push(`clipped text: ${describe(el)}`)
    }
    for (const control of document.querySelectorAll<HTMLElement>(
      'button, [role=switch], [role=tab], a.btn-primary, a.btn-quiet'
    )) {
      const box = control.getBoundingClientRect()
      if (box.width === 0 && box.height === 0) continue
      for (const part of control.querySelectorAll<HTMLElement>('*')) {
        const r = part.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) continue
        if (
          r.left < box.left - 1 ||
          r.right > box.right + 1 ||
          r.top < box.top - 1 ||
          r.bottom > box.bottom + 1
        ) {
          issues.push(`part outside its control: ${describe(control)}`)
          break
        }
      }
    }
    return issues
  }, width)
}

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
})
mkdirSync(out, { recursive: true })
const report: string[] = [`# Visual pass`, '', `${new Date().toISOString()}`, '']
let problems = 0
for (const view of VIEWS.filter(v => !only || only.includes(v.name) || only.includes(v.route))) {
  for (const size of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.label === 'phone' ? 2 : 1,
      isMobile: size.label === 'phone',
      hasTouch: size.label === 'phone',
      permissions: ['camera'],
    })
    // tsx names functions with a __name helper that does not exist inside the page.
    await context.addInitScript({ content: 'globalThis.__name = f => f' })
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', e => errors.push(`page error: ${e.message}`))
    page.on('console', async m => {
      if (m.type() !== 'error') return
      const details = await Promise.all(m.args().map(a => a.jsonValue().catch(() => '')))
      errors.push(`console: ${details.map(String).join(' ').replace(/\s+/g, ' ').slice(0, 600)}`)
    })
    const base = view.app === 'dashboard' ? dashboard : capture
    await page.goto(`${base}/?shot=${view.name}#/preview/${view.route}`)
    await page.waitForFunction(() => document.body.innerText.length > 40, null, { timeout: 30_000 })
    await page.waitForTimeout(2500)
    if (view.prepare) await view.prepare(page)
    const issues = [...(await check(page, size.width)), ...errors]
    const file = `${view.name}-${size.label}.png`
    // Stretch the viewport to the page so fixed bars sit at the bottom, as on a device, instead
    // of floating mid-page in a full-page capture.
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.setViewportSize({
      width: size.width,
      height: Math.min(Math.max(height, size.height), 8000),
    })
    await page.waitForTimeout(400)
    await page.screenshot({ path: resolve(out, file) })
    problems += issues.length
    report.push(`- **${file}**: ${issues.length ? issues.join('; ') : 'ok'}`)
    console.log(
      `${file}  ${issues.length ? `${issues.length} issue(s)\n    ${issues.join('\n    ')}` : 'ok'}`
    )
    await context.close()
  }
}
await browser.close()
writeFileSync(resolve(out, 'visual-pass.md'), `${report.join('\n')}\n`)
console.log(
  `\n${problems ? `${problems} issue(s)` : 'no issues'}; screenshots and visual-pass.md in ${out}`
)
