import { ExternalLink } from 'lucide-react'
import { sourceLink } from '../lib/sources'

// A citation (polish 30 Oct): the publisher and the document's title in one chip that opens the
// original document in a new tab. A source with no public address shows the same chip, unlinked.
export function SourceChip({ uri, title, tier }: { uri: string; title: string; tier: number }) {
  const s = sourceLink(uri, title, tier)
  const body = (
    <>
      <span className="shrink-0 font-semibold text-fg">{s.publisher}</span>
      <span className="min-w-0">{s.title}</span>
      {s.href && <ExternalLink size={16} aria-hidden className="shrink-0 text-fg-2" />}
    </>
  )
  const className =
    'inline-flex max-w-full items-start gap-1.5 rounded-[10px] bg-well px-2.5 py-1 text-left text-caption text-fg'
  return s.href ? (
    <a
      href={s.href}
      target="_blank"
      rel="noreferrer"
      title={`${s.title}: opens the original document`}
      className={`${className} hover:bg-signal-tint`}
    >
      {body}
    </a>
  ) : (
    <span className={className}>{body}</span>
  )
}

// Every document a piece of advice cites, as a wrapping row of chips: one chip a document,
// however many of its passages were retrieved.
export function SourceChips({
  sources,
}: {
  sources: readonly { uri: string; title: string; tier: number }[]
}) {
  const documents = sources.filter((s, i) => sources.findIndex(o => o.uri === s.uri) === i)
  return (
    <ul className="flex flex-wrap gap-1.5">
      {documents.map(s => (
        <li key={s.uri} className="max-w-full">
          <SourceChip {...s} />
        </li>
      ))}
    </ul>
  )
}
