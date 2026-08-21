export interface TextPatch {
  from: number
  to: number
  insert: string
}

/**
 * The smallest single-range replacement turning `current` into `next`, or
 * undefined when they are already equal. Trimming the shared prefix and suffix
 * keeps CodeMirror's selection, scroll position and decorations anchored to the
 * text that did not change.
 */
export function computeTextPatch(current: string, next: string): TextPatch | undefined {
  if (current === next) return undefined

  const maxPrefix = Math.min(current.length, next.length)
  let prefix = 0
  while (prefix < maxPrefix && current.charCodeAt(prefix) === next.charCodeAt(prefix)) {
    prefix++
  }

  const maxSuffix = maxPrefix - prefix
  let suffix = 0
  while (
    suffix < maxSuffix &&
    current.charCodeAt(current.length - 1 - suffix) === next.charCodeAt(next.length - 1 - suffix)
  ) {
    suffix++
  }

  return {
    from: prefix,
    to: current.length - suffix,
    insert: next.slice(prefix, next.length - suffix),
  }
}
