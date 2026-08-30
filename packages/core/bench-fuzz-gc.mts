import { PerformanceObserver } from 'node:perf_hooks'

import fc from 'fast-check'

import { checkRoundTrip } from './src/converters/check-roundtrip.ts'

// @ts-expect-error absolute path import for the benchmark only
import { xorshift128plus } from '/tmp/meowdown-research/node_modules/.pnpm/pure-rand@8.4.2/node_modules/pure-rand/lib/esm/generator/xorshift128plus.js'
// @ts-expect-error absolute path import for the benchmark only
import { uniformInt } from '/tmp/meowdown-research/node_modules/.pnpm/pure-rand@8.4.2/node_modules/pure-rand/lib/esm/distribution/uniformInt.js'
// @ts-expect-error absolute path import for the benchmark only
import { congruential32 } from '/tmp/meowdown-research/node_modules/.pnpm/pure-rand@8.4.2/node_modules/pure-rand/lib/esm/generator/congruential32.js'
// @ts-expect-error absolute path import for the benchmark only
import { xoroshiro128plus } from '/tmp/meowdown-research/node_modules/.pnpm/pure-rand@8.4.2/node_modules/pure-rand/lib/esm/generator/xoroshiro128plus.js'

const mode = process.argv[2] as string
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

const ALL_TOKENS = [...TOKENS_BASE, ...TOKENS_RUNS]

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function runHand(usePureRand: boolean, doCheck: boolean, fastDraw = false): void {
  const parts: string[] = []
  const rng = usePureRand ? xorshift128plus(SEED) : null
  const next32 = usePureRand ? null : mulberry32(SEED)
  const randInt = (max: number): number => {
    if (rng && fastDraw) return ((rng.next() >>> 0) % (max + 1))
    if (rng) return uniformInt(rng, 0, max)
    return Math.floor(next32!() * (max + 1))
  }
  for (let i = 0; i < NUM_RUNS; i++) {
    const len = minLength + randInt(maxLength - minLength)
    parts.length = 0
    for (let j = 0; j < len; j++) parts.push(ALL_TOKENS[randInt(ALL_TOKENS.length - 1)])
    const input = parts.join('')
    if (doCheck) check(input)
  }
}

const t0 = performance.now()
if (mode === 'gen') {
  fc.assert(fc.property(arb, () => true), { seed: SEED, numRuns: NUM_RUNS })
} else if (mode === 'gen-unbiased') {
  fc.assert(fc.property(arb, () => true), { seed: SEED, numRuns: NUM_RUNS, unbiased: true })
} else if (mode === 'full') {
  fc.assert(fc.property(arb, check), { seed: SEED, numRuns: NUM_RUNS })
} else if (mode === 'hand') {
  runHand(true, false)
} else if (mode === 'hand-fast') {
  runHand(true, false, true)
} else if (mode === 'hand-full') {
  runHand(true, true)
} else if (mode === 'hand32') {
  runHand(false, false)
} else if (mode === 'pool-xorshift') {
  runPool(xorshift128plus, false)
} else if (mode === 'pool-xoroshiro') {
  runPool(xoroshiro128plus, false)
} else if (mode === 'pool-cong') {
  runPool(congruential32, false)
} else if (mode === 'pool-xorshift-full') {
  runPool(xorshift128plus, true)
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


function runPool(rngFactory: (seed: number) => { next: () => number }, doCheck: boolean): void {
  const pool = ALL_TOKENS
  const rng = rngFactory(SEED)
  const between = (min: number, max: number): number => min + ((rng.next() >>> 0) % (max - min + 1))
  const parts: string[] = []
  for (let i = 0; i < NUM_RUNS; i++) {
    parts.length = 0
    const len = between(minLength, maxLength)
    for (let j = 0; j < len; j++) parts.push(pool[between(0, pool.length - 1)])
    const input = parts.join('')
    if (doCheck) check(input)
  }
}

