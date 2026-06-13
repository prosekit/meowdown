import { languages } from '@codemirror/language-data'

/**
 * A code block language that meowdown can syntax-highlight.
 */
export interface CodeBlockLanguage {
  /**
   * The value stored in a `codeBlock` node's `language` attribute. It is an
   * idiomatic Markdown fence info string (e.g. `typescript`, `rust`).
   */
  value: string
  /**
   * A human-readable label for the language (e.g. `TypeScript`, `Rust`).
   */
  label: string
}

/**
 * The languages meowdown can syntax-highlight, ready to populate a language
 * picker. Each `value` round-trips through a code block's `language` attribute
 * and is matched back to a grammar case-insensitively.
 */
export const codeBlockLanguages: readonly CodeBlockLanguage[] = languages.map((description) => ({
  value: description.name.toLowerCase(),
  label: description.name,
}))
