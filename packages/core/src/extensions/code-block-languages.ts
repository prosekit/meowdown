import { languages } from '@codemirror/language-data'

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

/**
 * A list of languages for code block syntax-highlight.
 */
export const codeBlockLanguages: ReadonlyArray<{ label: string; value: string }> = languages
  .map((language) => language.name)
  .filter((name) => !excludeLanguages.has(name))
  .map((name) => ({ label: name, value: name.toLowerCase() }))
  .concat({ label: 'Plain text', value: '' })
  .sort((a, b) => a.label.localeCompare(b.label))
