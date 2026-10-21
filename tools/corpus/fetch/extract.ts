import { Readability } from '@mozilla/readability'
import { gfm } from '@joplin/turndown-plugin-gfm'
import { JSDOM, VirtualConsole } from 'jsdom'
import TurndownService from 'turndown'
import { extractText, getDocumentProxy } from 'unpdf'
import { stringify } from 'yaml'

export interface Page {
  title: string
  markdown: string
}

// The main content of an HTML page as markdown: Readability strips navigation and
// boilerplate, and tables survive as GFM tables. Scripts never run.
export function htmlToMarkdown(html: string, url: string): Page {
  const virtualConsole = new VirtualConsole() // silence CSS/script parse noise
  const dom = new JSDOM(html, { url, virtualConsole })
  const article = new Readability(dom.window.document).parse()
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
  turndown.use(gfm)
  const content = article?.content ?? dom.window.document.body?.innerHTML ?? ''
  const title = (article?.title || dom.window.document.title || url).trim()
  return { title, markdown: turndown.turndown(content).trim() }
}

export function withFrontmatter(
  page: Page,
  meta: {
    source_url: string
    retrieved_at: string
    archive_url?: string | null
    fetched_url?: string | null
  }
) {
  const frontmatter = stringify({
    title: page.title,
    source_url: meta.source_url,
    retrieved_at: meta.retrieved_at,
    ...(meta.archive_url ? { archive_url: meta.archive_url } : {}),
    ...(meta.fetched_url ? { fetched_url: meta.fetched_url } : {}),
  })
  return `---\n${frontmatter}---\n\n${page.markdown}\n`
}

export interface PdfText {
  pages: number
  // Extracted text, one entry per page.
  text: string[]
}

export async function pdfText(body: Buffer): Promise<PdfText> {
  const pdf = await getDocumentProxy(new Uint8Array(body))
  const { totalPages, text } = await extractText(pdf, { mergePages: false })
  return { pages: totalPages, text }
}

// A scanned (image-only) PDF has little or no extractable text: it needs OCR before it is
// worth ingesting.
export function needsOcr({ pages, text }: PdfText) {
  if (pages === 0) return true
  const chars = text.map(page => page.replace(/\s+/g, '').length)
  const sparse = chars.filter(n => n < 50).length
  const average = chars.reduce((sum, n) => sum + n, 0) / pages
  return average < 200 || sparse / pages > 0.5
}
