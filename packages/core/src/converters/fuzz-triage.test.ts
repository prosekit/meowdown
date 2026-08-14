import fc from 'fast-check'
import { it } from 'vitest'

import { gfmBlockOnlyParser } from '@meowdown/markdown'

import { checkRoundTrip } from './check-roundtrip.ts'
import { markdownToDoc } from './md-to-pm.ts'
import { docToMarkdown } from './pm-to-md.ts'

const ASCII = fc.string({ unit: 'grapheme-ascii', minLength: 1, maxLength: 100 })
const TOKENS = fc.string({
  unit: fc.constantFrom(...[...'->#*`= \n\t$|.1[]a']),
  minLength: 1,
  maxLength: 32,
})

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

function report(label: string, arbitrary: fc.Arbitrary<string>, seed: number): void {
  const samples = fc.sample(arbitrary, { numRuns: 20_000, seed })
  const groups = new Map<string, { verdict: string; count: number; original: string }>()
  for (const sample of samples) {
    const verdict = classify(sample)
    if (verdict === 'ok') continue
    const minimal = reduce(sample)
    const existing = groups.get(minimal)
    if (existing) {
      existing.count++
      continue
    }
    groups.set(minimal, { verdict, count: 1, original: sample })
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].count - a[1].count)
  const lines = sorted.map(
    ([minimal, info]) =>
      `${String(info.count).padStart(5)} ${info.verdict.padEnd(5)} ${JSON.stringify(minimal)}`,
  )
  console.info(
    `### ${label}: ${groups.size} distinct / ${samples.length} samples\n${lines.join('\n')}`,
  )
}

it('triage ascii', { timeout: 600_000 }, () => {
  report('ascii', ASCII, 1)
})

it('triage tokens', { timeout: 600_000 }, () => {
  report('tokens', TOKENS, 2)
})

const INSPECT: string[] = [']\n\t>\n-', 'a\n\t>\n-']

it('inspect', () => {
  for (const input of INSPECT) {
    const doc = markdownToDoc(input)
    const out = docToMarkdown(doc)
    const reparsed = docToMarkdown(markdownToDoc(out))
    console.info(
      [
        `--- in  ${JSON.stringify(input)}`,
        `    out ${JSON.stringify(out)}`,
        `    re  ${JSON.stringify(reparsed)}`,
        `    doc ${JSON.stringify(doc.toJSON())}`,
      ].join('\n'),
    )
  }
})

it('probe trees', () => {
  const inputs = ['> a\n> b\n> -', 'a\n\t>\n-']
  const rows: string[] = []
  for (const input of inputs) {
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

it('probe continuations', () => {
  const seconds = [
    '=',
    '==',
    '-',
    '--',
    '---',
    '*',
    '+',
    '1.',
    '1)',
    '#',
    '# h',
    '> q',
    '```',
    '~~~',
    '$$',
    '| a |',
    '    code',
    '<div>',
    '***',
    '___',
    'plain',
    '- x',
    '\\=',
    '=x',
    'x=',
  ]
  const rows: string[] = []
  for (const second of seconds) {
    for (const container of ['>a\n', '- a\n', '> - a\n']) {
      const input = container + second
      const doc = markdownToDoc(input)
      const out = docToMarkdown(doc)
      const stable = markdownToDoc(out).eq(doc)
      const paragraphHoldsIt = JSON.stringify(doc.toJSON()).includes(
        JSON.stringify(`a\n${second}`).slice(1, -1),
      )
      rows.push(
        `${stable ? '   ' : 'BAD'} lazy=${paragraphHoldsIt ? 'y' : 'n'} ${JSON.stringify(input).padEnd(18)} -> ${JSON.stringify(out)}`,
      )
    }
  }
  console.info(rows.join('\n'))
})
