import { defineKeymap, toggleNode, withSkipCodeBlock, type PlainExtension } from '@prosekit/core'

export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const

export function defineHeadingShortcuts(): PlainExtension {
  const keymap = Object.fromEntries(
    HEADING_LEVELS.map((level) => [
      `Mod-${level}`,
      withSkipCodeBlock(toggleNode({ type: 'heading', attrs: { level } })),
    ]),
  )
  return defineKeymap(keymap)
}
