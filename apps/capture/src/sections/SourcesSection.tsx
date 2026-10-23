import { BookOpen } from 'lucide-react'
import type { RecommendationView } from '@repo/shared'
import { TIER_NAMES } from '../lib/copy'

// Where the advice comes from: every recommendation cites at least one guide (buildplan §4.3).
export function SourcesSection({ sources }: { sources: RecommendationView['sources'] }) {
  return (
    <div>
      <p className="eyebrow mb-1 flex items-center gap-1.5">
        <BookOpen size={16} strokeWidth={2.25} aria-hidden />
        From these guides
      </p>
      <ul>
        {sources.map(source => (
          <li key={source.uri} className="border-b border-rule py-2 last:border-b-0">
            <a
              href={source.uri}
              target="_blank"
              rel="noreferrer"
              className="text-label font-semibold underline decoration-rule decoration-2 underline-offset-4"
            >
              {source.title}
            </a>
            <p className="mt-0.5 font-mono text-eyebrow font-semibold uppercase text-copper">
              {TIER_NAMES[source.tier] ?? 'Source'}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
