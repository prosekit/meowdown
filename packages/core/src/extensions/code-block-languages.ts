import { languages } from '@codemirror/language-data'

export type LanguageItem = {
  label: string
  value: string
}

const excludeLanguages = new Set([
  // Uncommon languages
  'MscGen',
  'Xù',
  'MsGenny',
  'Angular Template',
  'Brainfuck',
  'Esper',
  'Oz',
  'Factor',
  'Squirrel',
  'Yacas',
  'mIRC',
  'FCL',
  'ECL',
  'MUMPS',
  'Pig',
  'Asterisk',
  'Z80',

  // Replaced by 'Math'
  'Mathematica',
])

const extraLanguages = [
  { label: 'Plain text', value: '' },
  { label: 'Math', value: 'math' },
  { label: 'Mermaid', value: 'mermaid' },
]

/**
 * A list of languages for code block syntax-highlight.
 */
export const codeBlockLanguages: ReadonlyArray<LanguageItem> = languages
  .map((language) => ({ label: language.name, value: language.name.toLowerCase() }))
  .filter((language) => !excludeLanguages.has(language.label))
  .concat(extraLanguages)
  .sort((a, b) => a.label.localeCompare(b.label))
