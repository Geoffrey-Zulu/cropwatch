import { afterEach, describe, it, expect, vi } from 'vitest'
import { annexCsv, findAnnexRows } from './annex'
import { htmlToMarkdown, needsOcr, withFrontmatter } from './extract'
import { CookieJar, HostLimiter, isPdf, politeGet, RobotsCache, USER_AGENT } from './http'
import { upsert, type ManifestEntry } from './manifest'
import { extractionConcern, renderReport, type Outcome } from './report'
import { outputPath, parseSources, type Source } from './sources'
import { newestSnapshot, parseArchiveUrl } from './wayback'
import { COLUMNS } from '../../regulatory/products'

const yaml = (id = 'fao-faw-ffs-guide-2018') => `
sources:
  - id: ${id}
    title: FAW guide
    url: https://www.fao.org/3/i8665en/I8665EN.PDF
    tier: 4
    source: FAO
    country: INT
    crop: [maize]
    issue: [fall_armyworm]
    year: 2018
    expect: pdf
    priority: true
`

describe('sources.yaml', () => {
  it('parses a curated source, with defaults', () => {
    const [source] = parseSources(yaml())
    expect(source).toMatchObject({
      id: 'fao-faw-ffs-guide-2018',
      priority: true,
      render: 'markdown',
      mirrors: [],
      redistribute: true,
    })
    expect(outputPath(source, 'pdf')).toBe('international/fao/fao-faw-ffs-guide-2018.pdf')
  })

  it('requires kebab-case ids ending in the year', () => {
    expect(() => parseSources(yaml('FAO_guide'))).toThrow()
    expect(() => parseSources(yaml('fao-guide'))).toThrow()
  })

  it('rejects duplicate ids and unknown issues', () => {
    expect(() => parseSources(yaml() + yaml().replace('sources:\n', ''))).toThrow('unique')
    expect(() => parseSources(yaml().replace('[fall_armyworm]', '[locusts]'))).toThrow()
  })

  it('files tiers into the technicaldoc §7 layout', () => {
    const at = (tier: number) => outputPath({ tier, id: 'x-2020' } as Source, 'md')
    expect([1, 2, 3, 4, 5, 6].map(at)).toEqual([
      'zambia/moa/x-2020.md',
      'zambia/zari/x-2020.md',
      'zambia/zmd/x-2020.md',
      'international/fao/x-2020.md',
      'international/cabi/x-2020.md',
      'research/x-2020.md',
    ])
  })
})

describe('HostLimiter', () => {
  const clock = () => {
    let now = 0
    const sleeps: number[] = []
    return {
      now: () => now,
      sleep: async (ms: number) => {
        sleeps.push(ms)
        now += ms
      },
      sleeps,
    }
  }

  it('spaces requests to one host by 2 s, and leaves other hosts alone', async () => {
    const c = clock()
    const limiter = new HostLimiter(c.now, c.sleep)
    await limiter.wait('a.zm')
    await limiter.wait('b.org')
    await limiter.wait('a.zm')
    expect(c.sleeps).toEqual([2000])
  })

  it('honours a longer Crawl-delay but never goes below 2 s', async () => {
    const c = clock()
    const limiter = new HostLimiter(c.now, c.sleep)
    limiter.setInterval('slow.zm', 5000)
    limiter.setInterval('fast.zm', 100)
    for (const host of ['slow.zm', 'slow.zm', 'fast.zm', 'fast.zm']) await limiter.wait(host)
    expect(c.sleeps).toEqual([5000, 2000])
  })
})

describe('politeGet', () => {
  afterEach(() => vi.unstubAllGlobals())
  const noWait = new HostLimiter(
    () => 0,
    async () => {}
  )

  it('identifies itself and retries 5xx with backoff', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const waits: number[] = []
    const response = await politeGet('https://a.zm/x', noWait, {
      sleep: async ms => void waits.push(ms),
    })
    expect(response.body.toString()).toBe('ok')
    expect(waits).toEqual([2000])
    expect(fetchMock.mock.calls[0][1].headers['user-agent']).toBe(USER_AGENT)
  })

  it('does not retry a 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('gone', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(politeGet('https://a.zm/x', noWait, { sleep: async () => {} })).rejects.toThrow(
      'HTTP 404'
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps a cookie set on a redirect, as a publisher cookie check expects', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: '/doc.pdf?cookieSet=1', 'set-cookie': 'JSESSIONID=abc; Path=/' },
        })
      )
      .mockResolvedValueOnce(new Response('%PDF-1.7', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await politeGet('https://kb.org/doc.pdf', noWait, {
      sleep: async () => {},
      jar: new CookieJar(),
    })
    expect(response.finalUrl).toBe('https://kb.org/doc.pdf?cookieSet=1')
    expect(fetchMock.mock.calls[1][1].headers.cookie).toBe('JSESSIONID=abc')
    expect(fetchMock.mock.calls[1][1].headers['user-agent']).toBe(USER_AGENT)
  })

  it('gives up after its attempts on network errors', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      politeGet('https://a.zm/x', noWait, { attempts: 3, sleep: async () => {} })
    ).rejects.toThrow('fetch failed')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe('RobotsCache', () => {
  afterEach(() => vi.unstubAllGlobals())
  const noWait = () =>
    new HostLimiter(
      () => 0,
      async () => {}
    )

  it('obeys rules for our user agent', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('User-agent: CropWatch-CorpusFetcher\nDisallow: /private\n', { status: 200 })
        )
    )
    const robots = new RobotsCache(noWait())
    expect(await robots.check('https://a.zm/private/doc.pdf')).toBe('disallowed')
    expect(await robots.check('https://a.zm/public/doc.pdf')).toBe('allowed')
  })

  it('treats a missing robots.txt as no rules, and an unreachable one as the site being down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })))
    expect(await new RobotsCache(noWait()).check('https://a.zm/x')).toBe('allowed')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('ECONNRESET')))
    expect(await new RobotsCache(noWait()).check('https://b.zm/x')).toBe('unreachable')
  })
})

describe('Wayback', () => {
  it('picks the newest snapshot that returned 200', () => {
    const cdx = [
      ['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'],
      ['k', '20200101000000', 'https://a.zm/x', 'application/pdf', '200', 'd', '1'],
      ['k', '20240101000000', 'https://a.zm/x', 'text/html', '302', 'd', '1'],
      ['k', '20230601000000', 'https://a.zm/x', 'application/pdf', '200', 'd', '1'],
    ]
    expect(newestSnapshot(cdx)).toEqual({
      timestamp: '20230601000000',
      rawUrl: 'https://web.archive.org/web/20230601000000id_/https://a.zm/x',
      archiveUrl: 'https://web.archive.org/web/20230601000000/https://a.zm/x',
    })
    expect(newestSnapshot([cdx[0]])).toBeNull()
  })

  it('reads a curated snapshot URL', () => {
    expect(
      parseArchiveUrl('https://web.archive.org/web/20250102030405/https://a.zm/x.pdf')?.rawUrl
    ).toBe('https://web.archive.org/web/20250102030405id_/https://a.zm/x.pdf')
    expect(parseArchiveUrl('https://example.org/x')).toBeNull()
  })
})

describe('extraction', () => {
  it('keeps the main content and its tables, drops navigation', () => {
    const html = `<html><head><title>FAW factsheet</title></head><body>
      <nav><a href="/">Home</a> | <a href="/about">About us</a></nav>
      <article><h1>Fall armyworm</h1>
        <p>Scout fields twice a week from emergence, checking 10 plants at each of five stations across the field.</p>
        <p>Look for window-pane feeding and frass in the whorl; act on damage, not on the moths you see in traps.</p>
        <table><tr><th>Stage</th><th>Threshold</th></tr><tr><td>V2–V6</td><td>20% damaged plants</td></tr></table>
      </article><footer>© Ministry · Privacy policy</footer></body></html>`
    const page = htmlToMarkdown(html, 'https://a.zm/faw')
    expect(page.markdown).toContain('Scout fields twice a week')
    expect(page.markdown).toMatch(/\| Stage \| Threshold \|/)
    expect(page.markdown).not.toContain('Privacy policy')
  })

  it('writes YAML frontmatter that survives awkward titles', () => {
    const md = withFrontmatter(
      { title: 'Tuta: a guide', markdown: 'Body' },
      { source_url: 'https://x', retrieved_at: '2026-10-21T00:00:00Z', archive_url: null }
    )
    expect(md).toMatch(/^---\ntitle: "Tuta: a guide"\nsource_url: https:\/\/x\nretrieved_at: /)
    expect(md).not.toContain('archive_url')
  })

  it('flags image-only PDFs for OCR', () => {
    // About a real page's worth of text (~1,000 characters).
    const page = 'Integrated pest management of fall armyworm. '.repeat(25)
    expect(needsOcr({ pages: 3, text: [page, page, page] })).toBe(false)
    expect(needsOcr({ pages: 3, text: ['', ' ', '12'] })).toBe(true)
    expect(needsOcr({ pages: 4, text: [page, page, '', ''] })).toBe(false)
    expect(needsOcr({ pages: 4, text: [page, '', '', ''] })).toBe(true)
    expect(needsOcr({ pages: 0, text: [] })).toBe(true)
  })

  it('recognises PDFs by their magic bytes', () => {
    expect(isPdf(Buffer.from('%PDF-1.7 ...'))).toBe(true)
    expect(isPdf(Buffer.from('<!doctype html>'))).toBe(false)
  })
})

describe('FAW annex candidates', () => {
  it('lifts product lines from an annex, for review only', () => {
    const pages = [
      'Chapter 3: scouting',
      'Annex 2. Registered products for fall armyworm\nTrade name Active ingredient Rate\nAlpha 5 EC Emamectin benzoate 10 ml/15 L\nBeta 20 SC chlorantraniliprole 5 ml/15 L',
    ]
    const { hasAnnex, rows } = findAnnexRows('zambia/moa/faw-manual-2026.pdf', pages)
    expect(hasAnnex).toBe(true)
    expect(rows.map(r => [r.page, r.ingredient])).toEqual([
      [2, 'emamectin benzoate'],
      [2, 'chlorantraniliprole'],
    ])
    const csv = annexCsv(rows)
    // Deliberately not the register header, so load-products refuses it as-is.
    expect(csv.split('\n')[0]).not.toBe(COLUMNS.join(','))
    expect(csv).toContain('CANDIDATE ONLY')
  })

  it('finds nothing without an annex', () => {
    expect(findAnnexRows('x.pdf', ['Use emamectin benzoate carefully.']).rows).toEqual([])
  })
})

describe('manifest and report', () => {
  const entry = (id: string) => ({ id }) as ManifestEntry

  it('upserts by id and stays sorted', () => {
    expect(upsert([entry('b-2020'), entry('a-2020')], entry('b-2020')).map(e => e.id)).toEqual([
      'a-2020',
      'b-2020',
    ])
  })

  it('applies the priority gate (≥ 6 of the priority documents)', () => {
    const outcome = (i: number, status: Outcome['status']): Outcome => ({
      source: {
        id: `doc-${i}-2020`,
        priority: true,
        tier: 5,
        title: 't',
        url: 'https://x',
      } as Source,
      status,
      entry: status === 'failed' ? undefined : ({ file: 'f', needs_ocr: false } as ManifestEntry),
      reason: status === 'failed' ? 'HTTP 404' : undefined,
    })
    const six = [1, 2, 3, 4, 5, 6].map(i => outcome(i, 'fetched'))
    expect(
      renderReport([...six, outcome(7, 'failed'), outcome(8, 'failed')], null, 'now').gate
    ).toBe(true)
    const five = renderReport(
      [...six.slice(1), outcome(7, 'failed'), outcome(8, 'failed'), outcome(9, 'failed')],
      null,
      'now'
    )
    expect(five.gate).toBe(false)
    expect(five.markdown).toContain('## To fetch by hand')
  })

  it('flags thin pages and sparse PDFs, and lists what stays out of git', () => {
    const md = { format: 'md', text_chars: 69, pages: null, needs_ocr: false } as ManifestEntry
    const sparse = { format: 'pdf', text_chars: 4000, pages: 16, needs_ocr: false } as ManifestEntry
    const dense = { format: 'pdf', text_chars: 40000, pages: 16, needs_ocr: false } as ManifestEntry
    expect(extractionConcern(md)).toBe('thin page: 69 characters of main content')
    expect(extractionConcern(sparse)).toBe('sparse text: 250 characters a page')
    expect(extractionConcern(dense)).toBeNull()

    const report = renderReport(
      [
        {
          source: {
            id: 'cimmyt-guide-2018',
            priority: true,
            tier: 6,
            title: 't',
            url: 'https://x',
          } as Source,
          status: 'mirror',
          entry: {
            ...dense,
            file: 'research/cimmyt-guide-2018.pdf',
            fetched_url: 'https://mirror/x.pdf',
            redistribute: false,
            licence: 'All rights reserved',
          } as ManifestEntry,
          failures: ['live: HTTP 403'],
        },
      ],
      null,
      'now'
    )
    expect(report.markdown).toContain('(not in git)')
    expect(report.markdown).toContain('## Not committed (licence)')
    expect(report.markdown).toContain('fetched from mirror <https://mirror/x.pdf>; live: HTTP 403')
  })
})
