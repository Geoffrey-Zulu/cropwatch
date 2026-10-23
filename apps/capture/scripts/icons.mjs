// Renders public/icons/icon.svg to the PNGs the web manifest and iOS need, with headless
// Chrome or Edge (CHROMIUM_PATH to override). Re-run after changing the SVG:
//   pnpm --filter capture icons
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ICONS = fileURLToPath(new URL('../public/icons/', import.meta.url))
const svg = readFileSync(join(ICONS, 'icon.svg'), 'utf8')
// Maskable: full-bleed signboard, artwork inside the 80% safe zone.
const maskable = svg
  .replace('rx="96" fill="#17130F"', 'fill="#17130F"')
  .replace('<g transform="rotate(-8 256 256)">', '<g transform="translate(51.2 51.2) scale(0.8) rotate(-8 256 256)">')

const browser = [
  process.env.CHROMIUM_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(path => path && existsSync(path))
if (!browser) throw new Error('No Chrome/Edge found; set CHROMIUM_PATH')

const work = mkdtempSync(join(tmpdir(), 'cropwatch-icons-'))
function render(source, size, out, background = 'transparent') {
  const page = join(work, `${out}.html`)
  writeFileSync(
    page,
    `<html><body style="margin:0;background:${background}">${source.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`
  )
  execFileSync(browser, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--default-background-color=00000000',
    `--window-size=${size},${size}`,
    `--screenshot=${join(ICONS, out)}`,
    pathToFileURL(page).href,
  ])
  console.log(`  ${out} (${size}px)`)
}

render(svg, 192, 'icon-192.png')
render(svg, 512, 'icon-512.png')
render(maskable, 512, 'icon-maskable-512.png', '#17130F')
render(maskable, 180, 'apple-touch-icon.png', '#17130F')
