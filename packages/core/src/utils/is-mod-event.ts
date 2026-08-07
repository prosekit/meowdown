import { isApple } from '@prosekit/core'

/**
 * Whether the platform's mod key is held on `event`: `Command` on Apple, `Ctrl` elsewhere.
 */
export function isModEvent(
  event: MouseEvent | KeyboardEvent | TouchEvent | { metaKey: boolean; ctrlKey: boolean },
): boolean {
  return isApple ? event.metaKey : event.ctrlKey
}
