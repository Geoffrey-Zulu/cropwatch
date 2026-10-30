import { BookOpen } from 'lucide-react'
import type { RecommendationView } from '@repo/shared'
import { TIER_NAMES } from '../lib/copy'

// Where the advice comes from: every recommendation cites at least one guide (buildplan §4.3).
export function SourcesSection({ sources }: { sources: RecommendationView['sources'] }) {
  return (
    <div>
      <p className="eyebrow mb-1 flex items-center gap-2">
        <BookOpen size={16} strokeWidth={2} aria-hidden />
        From these guides
      </p>
      <ul>
        {sources.map(source => (
          <li key={source.uri} className="border-b border-hairline py-2.5 last:border-b-0">
            <a
              href={source.uri}
              target="_blank"
              rel="noreferrer"
              className="text-label font-semibold text-signal-text underline decoration-[rgb(45_91_57/0.35)] decoration-1 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-signal"
            >
              {source.title}
            </a>
            <p className="mt-0.5 text-caption font-semibold text-fg-2">
              {TIER_NAMES[source.tier] ?? 'Source'}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
