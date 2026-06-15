import { HEADING_LEVELS } from './heading-shortcuts.ts'

const INLINE_BINDINGS: Record<string, string> = {
  'Mod-b': 'Bold',
  'Mod-i': 'Italic',
  'Mod-e': 'Inline code',
  'Mod-Shift-x': 'Strikethrough',
}

/** Human-readable descriptions of the editor's formatting and heading shortcuts. */
export const EDITOR_KEY_BINDINGS: Record<string, string> = {
  ...INLINE_BINDINGS,
  ...Object.fromEntries(
    HEADING_LEVELS.flatMap((level) => [
      [`Mod-${level}`, `Heading ${level}`],
      [`Mod-Alt-${level}`, `Heading ${level}`],
    ]),
  ),
}
