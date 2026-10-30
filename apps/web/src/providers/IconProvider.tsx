import { LucideProvider } from 'lucide-react'
import type { ReactNode } from 'react'

// One icon set (Lucide), one weight: 20 px with a 1.5 px stroke for navigation and actions.
// Icons set inline with text pass size={16}; the stroke stays 1.5 px at any size.
export function IconProvider({ children }: { children: ReactNode }) {
  return (
    <LucideProvider size={20} strokeWidth={1.5} absoluteStrokeWidth>
      {children}
    </LucideProvider>
  )
}
