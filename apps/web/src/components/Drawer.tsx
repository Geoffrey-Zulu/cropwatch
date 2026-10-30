import { ChevronLeft, X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

// A right-side drawer over the page (patterns-v2.md decision 6): 480 px (400 px to 40% of the
// window), a shadow and no border, not modal, so the map stays visible and usable behind it.
// The heading takes focus on open; Escape or Close returns to the page and focus returns to
// whatever opened it. One drawer at a time: deeper detail replaces the content with a Back link.
export function Drawer({
  kicker,
  title,
  aside,
  back,
  closeHref,
  children,
}: {
  // One quiet line above the title: what this is, and when.
  kicker?: ReactNode
  title: ReactNode
  aside?: ReactNode
  back?: { href: string; label: string }
  closeHref: string
  children: ReactNode
}) {
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
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
      className="fixed bottom-0 right-0 top-14 z-40 flex w-full flex-col bg-panel shadow-raise sm:w-[min(480px,max(400px,40vw))]"
    >
      <header className="flex items-start gap-3 px-6 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          {back && (
            <a
              href={back.href}
              className="-ml-1 mb-2 inline-flex items-center gap-0.5 text-label font-medium text-signal-text hover:underline"
            >
              <ChevronLeft size={16} aria-hidden />
              {back.label}
            </a>
          )}
          {(kicker || aside) && (
            <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {kicker && <p className="meta">{kicker}</p>}
              {aside}
            </div>
          )}
          <h2
            ref={heading}
            id={id}
            tabIndex={-1}
            className="text-title font-semibold text-fg outline-none"
          >
            {title}
          </h2>
        </div>
        <a
          href={closeHref}
          aria-label="Close"
          className="-mr-2 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-card text-fg-2 hover:bg-well hover:text-fg"
        >
          <X aria-hidden />
        </a>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">{children}</div>
    </aside>
  )
}
