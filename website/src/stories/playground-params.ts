import type { EditorMode } from '@meowdown/react'
import LZString from 'lz-string'
import { createParser, parseAsBoolean, parseAsStringLiteral } from 'nuqs'

import { PRESETS } from '../presets/presets.ts'

export const MODES: readonly EditorMode[] = ['focus', 'show', 'hide']

export const SPELLCHECKS = ['default', 'on', 'off'] as const

export const PRESET_IDS = PRESETS.map((preset) => preset.id)

/**
 * Markdown compressed with lz-string's URI-safe alphabet. Damaged input either
 * throws or decodes to null; both mean "no shared document", so the parameter
 * falls back to the selected preset. An emptied document compresses to a
 * one-character payload and decodes to an empty string, which is a real value.
 */
const parseAsCompressedText = createParser({
  parse: (query) => {
    try {
      return LZString.decompressFromEncodedURIComponent(query) ?? null
    } catch {
      return null
    }
  },
  serialize: (value) => LZString.compressToEncodedURIComponent(value),
})

export const PLAYGROUND_PARAMS = {
  mode: parseAsStringLiteral(MODES).withDefault('focus'),
  doc: parseAsStringLiteral(PRESET_IDS).withDefault(PRESET_IDS[0]),
  spellcheck: parseAsStringLiteral(SPELLCHECKS).withDefault('default'),
  readOnly: parseAsBoolean.withDefault(false),
  blockHandle: parseAsBoolean.withDefault(true),
  caretGlide: parseAsBoolean.withDefault(true),
  source: parseAsBoolean.withDefault(true),
  content: parseAsCompressedText,
}
