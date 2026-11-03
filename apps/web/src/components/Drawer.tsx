import { ChevronLeft, X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

// A right-side drawer over the page in mockup A's language: a white island sliding in, its left
// corners rounded, 27 to 32 rem wide (40% of the window), not modal, so the map stays visible
// and usable behind it; full screen on phones and tablets.
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
      className="slide-in fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col bg-panel shadow-island lg:top-[3.75rem] lg:z-40 lg:w-[min(32rem,max(27rem,40vw))] lg:rounded-l-island"
    >
      <header className="flex items-start gap-3 px-[1.65rem] pb-4 pt-[1.45rem]">
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
            className="serif text-title font-semibold text-fg outline-none"
          >
            {title}
          </h2>
        </div>
        <a
          href={closeHref}
          aria-label="Close"
          className="-mr-2 -mt-1 inline-grid h-10 w-10 shrink-0 place-items-center rounded-pill text-fg-2 transition-colors duration-200 ease-out hover:bg-well hover:text-fg"
        >
          <X aria-hidden />
        </a>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-[1.65rem] pb-8">{children}</div>
    </aside>
  )
}
