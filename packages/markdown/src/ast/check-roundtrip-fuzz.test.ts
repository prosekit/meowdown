import { createStringPicker } from '@meowdown/vitest/random'
import { it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'
import { isMarkdownAstEqual } from './equal.ts'
import { parseMarkdownAst } from './parse.ts'
import { walkMarkdownAst } from './path.ts'
import { serializeMarkdownAst } from './serialize.ts'
import type { MarkdownDocument, MarkdownNode } from './types.ts'

// Use a fixed seed from the environment variable for reproducibility, or fallback to a random seed
const SEED = Number.parseInt(process.env.VITE_FUZZ_SEED || '') || Date.now()

const NUM_SAMPLES = 50_000

/// keep-sorted
const TOKENS_NEWLINE: readonly string[] = ['\n']

/// keep-sorted
const TOKENS_STRUCTURAL: readonly string[] = [
  ' ',
  '-',
  '*',
  '\t',
  '#',
  '`',
  '+',
  '=',
  '>',
  '|',
  '~',
  '$',
]

/// keep-sorted
const TOKENS_BASE: readonly string[] = [
  '_',
  ',',
  ';',
  ':',
  '!',
  '?',
  '.',
  '"',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  '@',
  '/',
  '\\',
  '&',
  '#',
  '%',
  '`',
  '^',
  '<',
  '>',
  '|',
  '~',
  '$',
  '0',
  '1',
  '2',
  '3',
  '9',
  'a',
  'A',
  'b',
  "'",
]

/// keep-sorted
const TOKENS_EXTENDED: readonly string[] = [
  '’',
  '«',
  '\f',
  '\r\n',
  '\u{200D}',
  '\u{300}',
  '\u{3000}',
  '\u{A0}',
  '\u{FEFF}',
  '\u{FFFD}',
  '\v',
  '🍄',
  '€',
  '永',
]

/// keep-sorted
const TOKENS_RUNS: readonly string[] = [
  '---',
  '-->',
  '```',
  '````',
  '<!--',
  '<?',
  '<'.repeat(7),
  '='.repeat(7),
  '>'.repeat(7),
  '>',
  '| --- |',
  '~~~',
  '~~~~',
  '$$',
  '1. ',
]

function repeat(tokens: readonly string[], times: number): string[] {
  return Array.from({ length: times }, () => tokens).flat()
}

const POOLS = [
  {
    name: 'base',
    pool: [...TOKENS_BASE, ...TOKENS_RUNS],
  },
  {
    name: 'extended',
    pool: [...TOKENS_NEWLINE, ...TOKENS_BASE, ...TOKENS_RUNS, ...TOKENS_EXTENDED],
  },
  {
    name: 'weighted',
    pool: [
      ...TOKENS_BASE,
      ...TOKENS_RUNS,
      ...repeat(TOKENS_STRUCTURAL, 3),
      ...repeat(TOKENS_NEWLINE, 10),
    ],
  },
] as const

const RANGES = [
  [1, 50],
  [51, 100],
  [101, 200],
  [201, 500],
] as const

function isLossy(input: string): boolean {
  return checkRoundTrip(input) === 'lossy'
}

/**
 * Every node but the document has a position inside its parent's and after its
 * previous sibling's, and CRLF line endings parse to the same tree as LF ones.
 */
function findPositionError(input: string): string | undefined {
  const document = parseMarkdownAst(input)
  const error = findNestingError(document, 0, input.length)
  if (error) return error
  if (!input.includes('\r')) return
  const twin = parseMarkdownAst(input.replaceAll(/\r\n?/g, '\n'))
  if (JSON.stringify(document) !== JSON.stringify(twin)) return 'CRLF and LF trees differ'
}

function findNestingError(node: MarkdownNode, from: number, to: number): string | undefined {
  let previousTo = from
  for (const child of node.children ?? []) {
    const position = child.position
    if (!position) return `${child.type} has no position`
    if (position.from < previousTo || position.to < position.from || position.to > to) {
      return `${child.type} at ${position.from}-${position.to} is outside ${previousTo}-${to}`
    }
    previousTo = position.to
    const error = findNestingError(child, position.from, position.to)
    if (error) return error
  }
}

/**
 * Set every block's recorded gap to `value`.
 */
function setBlankBefore(document: MarkdownDocument, value: false | undefined): MarkdownDocument {
  for (const { node } of walkMarkdownAst(document)) {
    if (node.type === 'document' || node.type === 'tableRow' || node.type === 'tableCell') continue
    node.blankBefore = value
  }
  return document
}

/**
 * The editor can move any block under any other and keep its recorded gap.
 * Asking every block to sit tight must still read back as the same blocks.
 */
function findForcedTightError(input: string): string | undefined {
  const document = setBlankBefore(parseMarkdownAst(input), undefined)
  const expected = setBlankBefore(parseMarkdownAst(serializeMarkdownAst(document)), undefined)
  // An input that does not read back the same with its gaps left to the
  // serializer says nothing about the gaps.
  if (!isMarkdownAstEqual(expected, document)) return
  const output = serializeMarkdownAst(setBlankBefore(parseMarkdownAst(input), false))
  const actual = setBlankBefore(parseMarkdownAst(output), undefined)
  if (!isMarkdownAstEqual(actual, expected))
    return `forced tight gaps change the blocks: ${JSON.stringify(output)}`
}

for (const [minLength, maxLength] of RANGES) {
  for (const { name, pool } of POOLS) {
    it(
      `finds no lossy input (minLength=${minLength}, maxLength=${maxLength}, pool=${name} samples=${NUM_SAMPLES})`,
      { timeout: 60_000 },
      () => {
        const pickString = createStringPicker(SEED, minLength, maxLength, pool)
        for (let sample = 1; sample <= NUM_SAMPLES; sample++) {
          const input = pickString()
          if (isLossy(input)) {
            throw new Error(
              `lossy input (seed=${SEED}, sample=${sample}, input=${JSON.stringify(input)})`,
            )
          }
          const forcedTightError = findForcedTightError(input)
          if (forcedTightError) {
            throw new Error(
              `${forcedTightError} (seed=${SEED}, sample=${sample}, input=${JSON.stringify(input)})`,
            )
          }
          const positionError = findPositionError(input)
          if (positionError) {
            throw new Error(
              `${positionError} (seed=${SEED}, sample=${sample}, input=${JSON.stringify(input)})`,
            )
          }
        }
      },
    )
  }
}
