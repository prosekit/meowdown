import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { createParser, parseAsBoolean, parseAsStringLiteral } from 'nuqs'

import { DEFAULT_PRESET_ID, PRESETS } from '../presets/presets.ts'

const MODE_VALUES = ['focus', 'show', 'hide'] as const

export const SPELLCHECK_VALUES = ['default', 'on', 'off'] as const

export const parseAsMode = parseAsStringLiteral(MODE_VALUES).withDefault('focus')
export const parseAsSpellcheck = parseAsStringLiteral(SPELLCHECK_VALUES).withDefault('default')
export const parseAsFlag = parseAsBoolean

// Preset ids come from the .md file names (import.meta.glob), not a literal
// union, so membership is checked at parse time.
export const parseAsPreset = createParser({
  parse: (value) => (PRESETS.some((preset) => preset.id === value) ? value : null),
  serialize: (value: string) => value,
}).withDefault(DEFAULT_PRESET_ID)

// The raw markdown travels lz-compressed; `decompress` returns null on
// garbage, which nuqs treats as "param absent".
export const parseAsCompressedMarkdown = createParser({
  parse: (value) => decompressFromEncodedURIComponent(value),
  serialize: (value: string) => compressToEncodedURIComponent(value),
})
