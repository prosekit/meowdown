import type { PlainExtension } from '@prosekit/core'

import { defineViewAttributes } from './view-attributes.ts'

/**
 * Set the `spellcheck` attribute on the editable root, turning the browser's
 * native spell checking on or off. The value lands at mount time, before the
 * element can receive focus (iOS reads the flag at focus time to derive the
 * keyboard's smart-punctuation traits).
 */
export function defineSpellCheckPlugin(spellCheck: boolean): PlainExtension {
  return defineViewAttributes({ spellcheck: spellCheck ? 'true' : 'false' })
}
