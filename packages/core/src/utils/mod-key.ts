import { isApple } from '@prosekit/core'

/**
 * Whether the platform's mod key is held on `event`: `⌘` on Apple, `Ctrl`
 * elsewhere. The single definition behind the `mod` field on link follow
 * payloads and the `Mod-Enter` follow trigger.
 */
export function isModHeld(event: MouseEvent | KeyboardEvent): boolean {
  return isApple ? event.metaKey : event.ctrlKey
}
