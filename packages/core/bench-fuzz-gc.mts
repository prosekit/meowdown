import { PerformanceObserver } from 'node:perf_hooks'

import fc from 'fast-check'

import { checkRoundTrip } from './src/converters/check-roundtrip.ts'

const mode = process.argv[2] as 'gen' | 'full' | 'corpus'
const minLength = Number(process.argv[3] || 1)
const maxLength = Number(process.argv[4] || 50)
const NUM_RUNS = 100_000
const SEED = 424242

const TOKENS_BASE = '_,;:!?."()[]{}@/\\&#%`^<>|~$01239aAb\''.split('')
const TOKENS_RUNS = ['---', '-->', '```', '````', '<!--', '<?', '<<<<<<< ', '===', '> ', '>>>>>>> ', '| --- |', '~~~', '~~~~', '$$', '1. ']
const arb = fc.string({
  unit: fc.constantFrom(...TOKENS_BASE, ...TOKENS_RUNS),
  minLength,
  maxLength,
  size: 'max',
})

let gcCount = 0
let gcMs = 0
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    gcCount += 1
    gcMs += e.duration
  }
}).observe({ entryTypes: ['gc'] })

function check(input: string): boolean {
  try {
    return checkRoundTrip(input) !== 'lossy'
  } catch {
    return false
  }
}

let corpus: string[] = []
if (mode === 'corpus') {
  corpus = fc.sample(arb, { numRuns: NUM_RUNS, seed: SEED })
}

const t0 = performance.now()
if (mode === 'gen') {
  fc.assert(fc.property(arb, () => true), { seed: SEED, numRuns: NUM_RUNS })
} else if (mode === 'full') {
  fc.assert(fc.property(arb, check), { seed: SEED, numRuns: NUM_RUNS })
} else {
  for (const input of corpus) check(input)
}
const elapsed = performance.now() - t0

await new Promise((resolve) => setTimeout(resolve, 50))
const mem = process.memoryUsage()
console.log(
  JSON.stringify({
    mode,
    minLength,
    maxLength,
    elapsedMs: Math.round(elapsed),
    gcCount,
    gcMs: Math.round(gcMs),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    rssMB: Math.round(mem.rss / 1024 / 1024),
  }),
)
