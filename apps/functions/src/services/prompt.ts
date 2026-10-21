import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// A versioned prompt from prompts/: frontmatter `version`, then `## system` and `## user`
// sections with {{placeholders}}.
export interface Prompt {
  version: string
  system: string
  user: string
}

// prompts/ is at the repo root locally and beside dist/ in the container, so look upward from
// this module until it turns up.
export function findPromptsDir(from = dirname(fileURLToPath(import.meta.url))) {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'prompts'))) return join(dir, 'prompts')
    if (dirname(dir) === dir) throw new Error(`No prompts/ directory above ${from}`)
  }
}

export function parsePrompt(text: string): Prompt {
  const normalised = text.replace(/\r\n/g, '\n')
  const version = /^---\nversion: *(\S+)\n---\n/.exec(normalised)?.[1]
  const system = /^## system\n([\s\S]*?)(?=^## user\n)/m.exec(normalised)?.[1]
  const user = /^## user\n([\s\S]*)$/m.exec(normalised)?.[1]
  if (!version || !system || !user) throw new Error('Prompt needs a version, ## system and ## user')
  return { version, system: system.trim(), user: user.trim() }
}

export function loadPrompt(name: string, dir = findPromptsDir()): Prompt {
  const prompt = parsePrompt(readFileSync(join(dir, `${name}.md`), 'utf8'))
  if (prompt.version !== name) throw new Error(`${name}.md declares version ${prompt.version}`)
  return prompt
}

// Fills {{placeholders}}; a missing value is a bug, so it throws rather than sending a hole.
export function render(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`No value for {{${key}}}`)
    return values[key]
  })
}
