import { languages } from '@codemirror/language-data'

const expcludeLanguages = new Set(['MscGen', 'Xù', 'MsGenny', 'Angular Template'])



/**
 * A list of languages for code block syntax-highlight.
 */
export const codeBlockLanguages: ReadonlyArray<{label: string, value: string}> = languages
  .map((language) => language.name)
  .filter((name) => !expcludeLanguages.has(name))
  .map((name) => ({ label: name, value: name.toLowerCase() }))
  .concat({ label: "Plain text", value: "" })
  .sort((a, b) => a.label.localeCompare(b.label))
