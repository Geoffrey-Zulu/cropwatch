// Contact sheets for the eyeball pass: every laptop shot on one sheet, every phone shot on
// another, labelled, so a person can look at all of them in a minute.
//   pnpm --filter @repo/visual sheet <shots dir>
import { readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const dir = resolve(
  process.env.INIT_CWD ?? process.cwd(),
  process.argv.slice(2).find(a => a !== '--') ?? 'visual-out'
)
const files = readdirSync(dir).filter(f => f.endsWith('.png') && !f.startsWith('sheet-'))

const browser = await chromium.launch({ channel: 'chrome' })
for (const [label, suffix, width, columns, maxHeight] of [
  ['laptop', '-laptop.png', 560, 3, 900],
  ['phone', '-phone.png', 220, 7, 1100],
] as const) {
  const shots = files.filter(f => f.endsWith(suffix)).sort()
  if (shots.length === 0) continue
  const cells = shots
    .map(
      f =>
        `<figure><div class="clip"><img src="${pathToFileURL(resolve(dir, f)).href}"></div><figcaption>${f.replace(suffix, '')}</figcaption></figure>`
    )
    .join('')
  const html = `<!doctype html><style>
    body{margin:0;padding:12px;background:#888;font:12px system-ui;display:grid;grid-template-columns:repeat(${columns},${width}px);gap:12px;align-items:start}
    figure{margin:0;background:#fff}.clip{max-height:${maxHeight}px;overflow:hidden}img{width:${width}px;display:block}
    figcaption{padding:4px 6px;background:#222;color:#fff}</style>${cells}`
  const page = await browser.newPage({
    viewport: { width: columns * (width + 12) + 12, height: 800 },
  })
  const htmlPath = resolve(dir, `sheet-${label}.html`)
  writeFileSync(htmlPath, html)
  await page.goto(pathToFileURL(htmlPath).href)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: resolve(dir, `sheet-${label}.png`), fullPage: true })
  console.log(`sheet-${label}.png  ${shots.length} shots`)
  await page.close()
}
await browser.close()
