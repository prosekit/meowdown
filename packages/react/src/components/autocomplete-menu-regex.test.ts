import { describe, expect, it } from 'vitest'

import {
  createSlashMenuRegex,
  createTagMenuRegex,
  createWikilinkMenuRegex,
} from './autocomplete-menu-regex.ts'

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

describe.each([
  ['lookbehind', true],
  ['fallback', false],
] as const)('tag-menu regex (%s)', (_, supportsLookbehind) => {
  const regex = createTagMenuRegex(supportsLookbehind)

  it.each(['#tag', 'text #tag', '#123'])('matches a tag in %j', (input) => {
    expect(matchedText(regex, input)).toBe(input.startsWith('text ') ? '#tag' : input)
  })

  it.each(['#', '# ', '#tag-name'])('rejects %j', (input) => {
    expect(matchedText(regex, input)).toBeUndefined()
  })
})

describe('tag-menu boundary handling', () => {
  it('rejects an in-word tag with lookbehind', () => {
    expect(matchedText(createTagMenuRegex(true), 'word#tag')).toBeUndefined()
  })

  it('preserves the fallback loose boundary behavior', () => {
    expect(matchedText(createTagMenuRegex(false), 'word#tag')).toBe('#tag')
  })
})

describe.each([
  ['lookbehind', true],
  ['fallback', false],
] as const)('wikilink-menu regex (%s)', (_, supportsLookbehind) => {
  const regex = createWikilinkMenuRegex(supportsLookbehind)

  it.each([
    ['[[', '[['],
    ['text [[Note name', '[[Note name'],
    ['@', '@'],
    ['text @Note name', '@Note name'],
  ])('matches a wikilink query in %j', (input, expected) => {
    expect(matchedText(regex, input)).toBe(expected)
  })

  it.each(['[', '[[Note]', '@ ', '@Note['])('rejects %j', (input) => {
    expect(matchedText(regex, input)).toBeUndefined()
  })
})

describe('wikilink-menu boundary handling', () => {
  it('rejects an in-word at-mention with lookbehind', () => {
    expect(matchedText(createWikilinkMenuRegex(true), 'word@Note')).toBeUndefined()
  })

  it('preserves the fallback loose boundary behavior', () => {
    expect(matchedText(createWikilinkMenuRegex(false), 'word@Note')).toBe('@Note')
  })
})
