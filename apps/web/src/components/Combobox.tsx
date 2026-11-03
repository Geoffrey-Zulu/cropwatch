import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'

export interface ComboOption {
  value: string
  label: string
  // Muted second part ("Chikuni").
  detail?: string
}

// The field-airy combobox, in place of every native select: a white field with a soft border and
// the green focus ring; open, it is an island list under the field (above it only when there is
// no room below), at most about 320 px tall with its own scroll. Typing filters; arrows move; Enter
// picks; Esc closes.
export function Combobox({
  label,
  options,
  value,
  onChange,
  placeholder = 'Type to filter',
}: {
  label: string
  options: ComboOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const id = useId()
  const listId = `${id}-list`
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [up, setUp] = useState(false)
  const selected = options.find(o => o.value === value)
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? options.filter(o => `${o.label} ${o.detail ?? ''}`.toLowerCase().includes(q))
      : options
  }, [options, query])

  const openList = () => {
    setQuery('')
    setActive(
      Math.max(
        0,
        options.findIndex(o => o.value === value)
      )
    )
    setOpen(true)
  }
  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) requestAnimationFrame(() => button.current?.focus())
  }
  const pick = (o: ComboOption) => {
    onChange(o.value)
    close()
  }

  // Downward unless the list would run off the bottom and there is more room above.
  useLayoutEffect(() => {
    if (!open || !box.current) return
    const r = box.current.getBoundingClientRect()
    const need = Math.min(320, 12 + options.length * 44)
    const below = window.innerHeight - r.bottom
    setUp(below < need && r.top > below)
    input.current?.focus()
  }, [open, options.length])
  // Keep the active option in view.
  useEffect(() => {
    if (!open) return
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active, open])
  // A press outside closes it.
  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) =>
      !box.current?.contains(event.target as Node) && close(false)
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const field =
    'flex h-10 w-full items-center gap-2 rounded-card border border-[rgb(27_41_32/0.2)] bg-panel px-3 text-left font-body text-label text-fg transition-[border-color,box-shadow] duration-200 ease-out focus:border-signal focus:outline-none focus:shadow-[0_0_0_3px_rgb(45_91_57/0.22)]'

  return (
    <div ref={box} className="relative">
      {open ? (
        <input
          ref={input}
          role="combobox"
          aria-label={label}
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={shown[active] ? `${id}-${active}` : undefined}
          className={field}
          placeholder={selected ? `${selected.label} · ${placeholder}` : placeholder}
          value={query}
          onChange={event => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActive(i => Math.min(shown.length - 1, i + 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive(i => Math.max(0, i - 1))
            } else if (event.key === 'Enter') {
              event.preventDefault()
              if (shown[active]) pick(shown[active])
            } else if (event.key === 'Escape') {
              event.preventDefault()
              close()
            } else if (event.key === 'Tab') close(false)
          }}
        />
      ) : (
        <button
          ref={button}
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={false}
          aria-controls={listId}
          className={field}
          onClick={openList}
          onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openList()
            }
          }}
        >
          <span className="min-w-0 flex-1 truncate">
            {selected ? (
              <>
                <span className="font-semibold">{selected.label}</span>
                {selected.detail && <span className="text-fg-2"> · {selected.detail}</span>}
              </>
            ) : (
              <span className="text-fg-2">{placeholder}</span>
            )}
          </span>
          <ChevronDown size={17} aria-hidden className="shrink-0 text-fg-2" />
        </button>
      )}
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={label}
          className={`island absolute left-0 right-0 z-40 max-h-[320px] overflow-y-auto overscroll-contain p-1 ${up ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
        >
          {shown.length === 0 ? (
            <li className="px-3 py-2.5 text-label text-fg-2">No match</li>
          ) : (
            shown.map((o, i) => {
              const on = o.value === value
              return (
                <li
                  key={o.value}
                  id={`${id}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={on}
                  className={`flex cursor-pointer items-center gap-2 rounded-[0.65rem] px-3 py-2.5 text-label ${i === active ? 'bg-well' : ''}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={event => {
                    event.preventDefault()
                    pick(o)
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className={on ? 'font-semibold text-signal-text' : 'text-fg'}>
                      {o.label}
                    </span>
                    {o.detail && <span className="text-fg-2"> · {o.detail}</span>}
                  </span>
                  {on && <Check size={15} aria-hidden className="shrink-0 text-signal" />}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
