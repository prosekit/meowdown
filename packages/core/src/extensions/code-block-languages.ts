import { languages } from '@codemirror/language-data'


const expcludeLanguages = new Set([
  "MscGen",
  "Xù",
  "MsGenny",
  "Angular Template",
])


/**
 * A list of code block language names that meowdown can syntax-highlight.
 */
export const codeBlockLanguages: readonly string[] = languages.map(
  language => language.name
).filter(name => !expcludeLanguages.has(name)).sort()
