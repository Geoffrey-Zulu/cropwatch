// UI copy carries no em dashes (design-system/phytos/MASTER.md §9). Model-written and seeded
// text can; this turns an em dash into a comma for display. Never apply it to a label dose,
// which is rendered byte-identical from the register (CLAUDE.md invariant 1).
export const withoutEmDash = (text: string) => text.replace(/\s*—\s*/g, ', ')
