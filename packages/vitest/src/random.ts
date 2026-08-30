import { uniformInt } from 'pure-rand/distribution/uniformInt'
import { xorshift128plus } from 'pure-rand/generator/xorshift128plus'

/**
 * Returns a generator that picks a random token from `tokens` on each call.
 */
export function createTokenPicker(seed: number, tokens: readonly string[]): () => string {
  const rng = xorshift128plus(seed)
  return () => tokens[uniformInt(rng, 0, tokens.length - 1)]
}

/**
 * Returns a generator that picks a random integer between `min` and `max` (inclusive) on each call.
 */
export function createIntPicker(seed: number, min: number, max: number): () => number {
  const rng = xorshift128plus(seed)
  return () => uniformInt(rng, min, max)
}

/**
 * Returns a generator that builds a random string on each call, with length between `minLength` and `maxLength` and content drawn from `tokens`.
 */
export function createStringPicker(
  seed: number,
  minLength: number,
  maxLength: number,
  tokens: readonly string[],
): () => string {
  const pickToken = createTokenPicker(seed, tokens)
  const pickLength = createIntPicker(seed + 1, minLength, maxLength)
  const parts: string[] = []
  return () => {
    parts.length = 0
    const length = pickLength()
    for (let i = 0; i < length; i++) {
      parts.push(pickToken())
    }
    return parts.join('')
  }
}
