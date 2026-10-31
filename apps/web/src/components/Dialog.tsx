import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

// A confirmation in mockup A's language: a white island over the page, on a light canvas scrim
// (never a dark one). Modal: the heading takes focus, Escape or Close cancels, and focus returns
// to whatever opened it. Used where a person must read before money moves.
export function Dialog({
  title,
  kicker,
  aside,
  onClose,
  children,
  footer,
}: {
  title: ReactNode
  kicker?: ReactNode
  // Beside the kicker: the DEMO pill when the figures are simulated.
  aside?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    heading.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-[rgb(244_243_236/0.78)] p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="slide-in island w-full max-w-[34rem] px-[1.65rem] pb-[1.4rem] pt-[1.45rem]"
      >
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
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
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-2 -mt-1 inline-grid h-10 w-10 shrink-0 place-items-center rounded-pill text-fg-2 transition-colors duration-200 ease-out hover:bg-well hover:text-fg"
          >
            <X aria-hidden />
          </button>
        </header>
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-5 flex flex-wrap items-center gap-2">{footer}</div>}
      </div>
    </div>
  )
}
