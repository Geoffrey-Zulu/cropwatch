import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

// A right-side drawer over the page (patterns-v2.md): the page stays visible and in place
// behind it, so opening detail never loses the context. Not modal: no backdrop. Escape or the
// close link returns to the page; the heading takes focus when it opens.
export function Drawer({
  kicker,
  title,
  question,
  aside,
  closeHref,
  width = 'detail',
  children,
}: {
  kicker?: ReactNode
  title: ReactNode
  // The one question this drawer answers, under the title.
  question?: string
  aside?: ReactNode
  closeHref: string
  width?: 'detail' | 'list'
  children: ReactNode
}) {
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [title])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') window.location.hash = closeHref
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeHref])
  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby={id}
      className={`fixed bottom-0 right-0 top-14 z-40 flex w-full flex-col border-l border-hairline bg-panel shadow-raise ${
        width === 'list' ? 'sm:w-[440px]' : 'sm:w-[600px]'
      }`}
    >
      <header className="flex items-start gap-4 border-b border-hairline px-6 py-4">
        <div className="min-w-0 flex-1">
          {kicker && <p className="eyebrow">{kicker}</p>}
          <h2
            ref={heading}
            id={id}
            tabIndex={-1}
            className="mt-1 text-title font-semibold leading-snug text-fg outline-none"
          >
            {title}
          </h2>
          {question && <p className="mt-1 text-label text-fg-2">{question}</p>}
          {aside && <div className="mt-2 flex flex-wrap gap-2">{aside}</div>}
        </div>
        <a
          href={closeHref}
          aria-label="Close"
          className="-mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-card text-fg-2 hover:bg-well hover:text-fg"
        >
          <X size={20} strokeWidth={2} aria-hidden />
        </a>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
    </aside>
  )
}
