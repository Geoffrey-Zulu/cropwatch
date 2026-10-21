import robotsParser from 'robots-parser'

// Honest identification. Set CORPUS_FETCH_CONTACT to add a contact address or URL.
export const USER_AGENT_TOKEN = 'CropWatch-CorpusFetcher'
export const USER_AGENT = `${USER_AGENT_TOKEN}/0.1 (curated crop-protection documents for a Zambian crop-health research prototype; rate-limited; respects robots.txt${
  process.env.CORPUS_FETCH_CONTACT ? `; contact ${process.env.CORPUS_FETCH_CONTACT}` : ''
})`

const MIN_INTERVAL_MS = 2000
const TIMEOUT_MS = 60_000
const MAX_REDIRECTS = 10

type Sleep = (ms: number) => Promise<void>
const realSleep: Sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// At most one request per host every 2 s (longer if robots.txt asks via Crawl-delay).
export class HostLimiter {
  private last = new Map<string, number>()
  private interval = new Map<string, number>()

  constructor(
    private now: () => number = Date.now,
    private sleep: Sleep = realSleep
  ) {}

  setInterval(host: string, ms: number) {
    this.interval.set(host, Math.max(MIN_INTERVAL_MS, ms))
  }

  async wait(host: string) {
    const gap = this.interval.get(host) ?? MIN_INTERVAL_MS
    const previous = this.last.get(host)
    if (previous !== undefined) {
      const wait = previous + gap - this.now()
      if (wait > 0) await this.sleep(wait)
    }
    this.last.set(host, this.now())
  }
}

// Session cookies per host, as any HTTP client keeps them: some publishers set one and redirect
// back to the same URL before serving a document.
export class CookieJar {
  private cookies = new Map<string, Map<string, string>>()

  store(host: string, setCookies: string[]) {
    const jar = this.cookies.get(host) ?? new Map<string, string>()
    for (const line of setCookies) {
      const [pair] = line.split(';')
      const eq = pair.indexOf('=')
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
    }
    this.cookies.set(host, jar)
  }

  header(host: string) {
    const jar = this.cookies.get(host)
    return jar?.size ? [...jar].map(([name, value]) => `${name}=${value}`).join('; ') : null
  }
}

const sharedJar = new CookieJar()

export interface Response {
  status: number
  contentType: string
  finalUrl: string
  body: Buffer
}

export const isRetryable = (status: number) => status === 429 || status >= 500

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
  }
}

// One GET, following redirects by hand so that cookies set along the way are sent on the next
// hop. Every hop waits its turn with the limiter.
async function getFollowing(url: string, limiter: HostLimiter, jar: CookieJar) {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { host } = new URL(current)
    await limiter.wait(host)
    const cookie = jar.header(host)
    const response = await fetch(current, {
      headers: { 'user-agent': USER_AGENT, accept: '*/*', ...(cookie ? { cookie } : {}) },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    jar.store(host, response.headers.getSetCookie())
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      await response.arrayBuffer()
      current = new URL(location, current).toString()
      continue
    }
    return { response, finalUrl: current }
  }
  throw new FetchError(`more than ${MAX_REDIRECTS} redirects`, 310)
}

// GET with per-host rate limiting and retry with exponential backoff (2 s, 4 s, 8 s) on
// network errors, timeouts, 429 and 5xx. Other 4xx are final.
export async function politeGet(
  url: string,
  limiter: HostLimiter,
  {
    attempts = 4,
    sleep = realSleep,
    jar = sharedJar,
  }: { attempts?: number; sleep?: Sleep; jar?: CookieJar } = {}
): Promise<Response> {
  let lastError: FetchError = new FetchError('not attempted')
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const { response, finalUrl } = await getFollowing(url, limiter, jar)
      const body = Buffer.from(await response.arrayBuffer())
      if (response.ok) {
        return {
          status: response.status,
          contentType: response.headers.get('content-type') ?? '',
          finalUrl,
          body,
        }
      }
      lastError = new FetchError(`HTTP ${response.status}`, response.status)
      if (!isRetryable(response.status)) throw lastError
    } catch (error) {
      if (error instanceof FetchError && error.status && !isRetryable(error.status)) throw error
      if (!(error instanceof FetchError)) {
        lastError = new FetchError(error instanceof Error ? error.message : String(error))
      }
    }
    if (attempt < attempts) await sleep(2000 * 2 ** (attempt - 1))
  }
  throw lastError
}

export type RobotsVerdict = 'allowed' | 'disallowed' | 'unreachable'

// robots.txt per origin (RFC 9309): a 4xx means no rules; an unreachable file means the site
// is down, which the caller treats like any other live failure.
export class RobotsCache {
  private cache = new Map<string, Promise<ReturnType<typeof robotsParser> | 'unreachable'>>()

  constructor(private limiter: HostLimiter) {}

  async check(url: string): Promise<RobotsVerdict> {
    const { origin, host } = new URL(url)
    if (!this.cache.has(origin)) this.cache.set(origin, this.load(origin, host))
    const robots = await this.cache.get(origin)!
    if (robots === 'unreachable') return 'unreachable'
    return robots.isAllowed(url, USER_AGENT_TOKEN) === false ? 'disallowed' : 'allowed'
  }

  private async load(origin: string, host: string) {
    const robotsUrl = `${origin}/robots.txt`
    try {
      const response = await politeGet(robotsUrl, this.limiter, { attempts: 2 })
      const robots = robotsParser(robotsUrl, response.body.toString('utf8'))
      const delay = robots.getCrawlDelay(USER_AGENT_TOKEN)
      if (delay) this.limiter.setInterval(host, delay * 1000)
      return robots
    } catch (error) {
      if (error instanceof FetchError && error.status && error.status < 500) {
        return robotsParser(robotsUrl, '')
      }
      return 'unreachable' as const
    }
  }
}

export const isPdf = (body: Buffer) => body.subarray(0, 5).toString('latin1') === '%PDF-'
