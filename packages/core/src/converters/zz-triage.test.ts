import fc from 'fast-check'
import { it } from 'vitest'

import { gfmBlockOnlyParser } from '@meowdown/markdown'

import { checkRoundTrip } from './check-roundtrip.ts'
import { markdownToDoc } from './md-to-pm.ts'
import { docToMarkdown } from './pm-to-md.ts'

const TOKENS: string[] = [
  ' ',
  '_',
  '-',
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
  '*',
  '/',
  '\\',
  '\n',
  '\t',
  '#',
  '`',
  '+',
  '<',
  '=',
  '>',
  '|',
  '~',
  '$',
  '1',
  '2',
  '3',
  'a',
  'b',
]

function classify(input: string): 'ok' | 'lossy' | 'throw' {
  try {
    return checkRoundTrip(input) === 'lossy' ? 'lossy' : 'ok'
  } catch {
    return 'throw'
  }
}

// Shrink by repeatedly dropping any single character that keeps the input bad.
function reduce(input: string): string {
  let current = input
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < current.length; i++) {
      const candidate = current.slice(0, i) + current.slice(i + 1)
      if (candidate.length > 0 && classify(candidate) !== 'ok') {
        current = candidate
        changed = true
        break
      }
    }
  }
  return current
}

// Run the real property, but never fail it: record every input that is lossy
// instead of stopping at the first, so a whole batch can be grouped at once.
function report(seed: number, runs: number): void {
  const failures: string[] = []
  fc.assert(
    fc.property(fc.string({ unit: fc.constantFrom(...TOKENS), minLength: 1, maxLength: 100 }), (input) => {
      if (classify(input) !== 'ok') failures.push(input)
      return true
    }),
    { seed, numRuns: runs },
  )
  const groups = new Map<string, number>()
  for (const failure of failures) {
    const minimal = reduce(failure)
    groups.set(minimal, (groups.get(minimal) ?? 0) + 1)
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1])
  const lines = sorted.map(([minimal, count]) => `${String(count).padStart(5)} ${JSON.stringify(minimal)}`)
  console.info(
    `### seed ${seed}: ${failures.length} lossy / ${runs} runs, ${groups.size} distinct\n${lines.join('\n')}`,
  )
}

it('triage', { timeout: 3_600_000 }, () => {
  for (let seed = 46; seed <= 120; seed++) report(seed, 1_000_000)
})

const INSPECT: string[] = ['*\ta\n\t\t-', ' 33)\n\t1', '- a\n\t\t-']

it('inspect', () => {
  for (const input of INSPECT) {
    const doc = markdownToDoc(input)
    const out = docToMarkdown(doc)
    const reparsed = markdownToDoc(out)
    console.info(
      [
        `--- in  ${JSON.stringify(input)}`,
        `    out ${JSON.stringify(out)}`,
        `    eq  ${reparsed.eq(doc)}`,
        `    doc ${JSON.stringify(doc.toJSON())}`,
        `    rdoc ${JSON.stringify(reparsed.toJSON())}`,
      ].join('\n'),
    )
  }
})

it('probe trees', () => {
  const rows: string[] = []
  for (const input of ['> [\n> $]:*', '> [foo]: /url\n>   "A title"', '> a\n> b\n> -']) {
    rows.push(`=== ${JSON.stringify(input)}`)
    const cursor = gfmBlockOnlyParser.parse(input).cursor()
    do {
      rows.push(
        `  ${cursor.type.name} [${cursor.from},${cursor.to}) ${JSON.stringify(input.slice(cursor.from, cursor.to))}`,
      )
    } while (cursor.next())
  }
  console.info(rows.join('\n'))
})
