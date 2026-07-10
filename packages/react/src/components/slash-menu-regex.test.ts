import { describe, expect, it } from 'vitest'

import { createSlashMenuRegex } from './slash-menu-regex.ts'

function matchedText(regex: RegExp, input: string): string | undefined {
  return regex.exec(input)?.[0]
}

describe.each([
  ['lookbehind', true],
  ['fallback', false],
] as const)('slash-menu regex (%s)', (_, supportsLookbehind) => {
  const regex = createSlashMenuRegex(supportsLookbehind)

  it.each([
    ['/', '/'],
    ['/table', '/table'],
    ['text /table', '/table'],
  ])('matches a single-slash command in %j', (input, expected) => {
    expect(matchedText(regex, input)).toBe(expected)
  })

  it.each(['// Dad', 'text // Dad'])('rejects the spaced double-slash alias in %j', (input) => {
    expect(matchedText(regex, input)).toBeUndefined()
  })
})

describe('slash-menu regex with lookbehind', () => {
  const regex = createSlashMenuRegex(true)

  it.each(['//', '//Dad', 'text //table', 'https://example.com'])('rejects %j', (input) => {
    expect(matchedText(regex, input)).toBeUndefined()
  })
})

describe('slash-menu regex fallback', () => {
  const regex = createSlashMenuRegex(false)

  it('preserves the documented loose boundary behavior', () => {
    expect(matchedText(regex, 'word/table')).toBe('/table')
    expect(matchedText(regex, '//')).toBe('/')
    expect(matchedText(regex, '//Dad')).toBe('/Dad')
  })
})
