// RFC 4180 CSV: quoted fields may hold commas, doubled quotes and newlines; CRLF or LF rows;
// an Excel UTF-8 BOM is dropped. Fields are NEVER trimmed: label_dose must survive
// byte-identical (CLAUDE.md invariant 1).
export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = 0

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  while (i < input.length) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"'
        i += 2
        continue
      }
      if (char === '"') {
        quoted = false
        i++
        continue
      }
      field += char
      i++
      continue
    }
    if (char === '"' && field === '') {
      quoted = true
    } else if (char === ',') {
      endField()
    } else if (char === '\r' && input[i + 1] === '\n') {
      endRow()
      i++
    } else if (char === '\n') {
      endRow()
    } else {
      field += char
    }
    i++
  }
  if (quoted) throw new Error('Unterminated quoted field')
  // A final line without a trailing newline.
  if (field !== '' || row.length > 0) endRow()
  return rows
}
