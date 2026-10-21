import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import { USER_AGENT } from './http'

const run = promisify(execFile)

const CANDIDATES = [
  process.env.CHROMIUM_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
]

export function findChromium() {
  return CANDIDATES.find(path => path && existsSync(path)) ?? null
}

// Headless Chromium print-to-PDF, for pages whose layout (tables) carries meaning. Uses the
// fetcher's honest User-Agent.
export async function printToPdf(url: string, outFile: string) {
  const chromium = findChromium()
  if (!chromium) throw new Error('No Chrome/Edge found; set CHROMIUM_PATH')
  await run(
    chromium,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--user-agent=${USER_AGENT}`,
      `--print-to-pdf=${outFile}`,
      url,
    ],
    { timeout: 120_000 }
  )
  if (!existsSync(outFile)) throw new Error('Chromium produced no PDF')
}
