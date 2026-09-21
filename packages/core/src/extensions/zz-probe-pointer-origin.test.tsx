import { describe, expect, it } from 'vitest'
import { commands, page, userEvent } from 'vitest/browser'

import { findText } from '../testing/find-text.ts'
import { setupFixture } from '../testing/index.ts'

const ITERATIONS = Number(import.meta.env.VITE_PROBE_ITERATIONS || 40)
const OUTPUT_DIR = String(import.meta.env.VITE_PROBE_OUTPUT_DIR || 'probe-output')

const pmRoot = page.locate('.ProseMirror')

interface Sample {
  i: number
  side: 'left' | 'right'
  snapshot: string
  ok: boolean
  // ms since the click call started
  mousedown?: number
  mouseup?: number
  selectionchange: number[]
  dispatches: Array<{
    t: number
    pointerMeta: boolean
    selectionSet: boolean
    sinceOrigin: number
    origin: string | null
  }>
  clickRoundTrip: number
}

interface ViewInput {
  lastSelectionTime: number
  lastSelectionOrigin: string | null
}

async function runOnce(i: number, side: 'left' | 'right'): Promise<Sample> {
  using fixture = setupFixture({ extensionOptions: { markMode: 'hide' } })
  const { n } = fixture
  fixture.set(n.doc(n.paragraph('foo **bold** bar')))
  fixture.view.focus()

  const view = fixture.view
  const sample: Sample = {
    i,
    side,
    snapshot: '',
    ok: false,
    selectionchange: [],
    dispatches: [],
    clickRoundTrip: 0,
  }

  let t0 = 0
  const onDown = () => (sample.mousedown = performance.now() - t0)
  const onUp = () => (sample.mouseup = performance.now() - t0)
  const onSel = () => sample.selectionchange.push(performance.now() - t0)
  window.addEventListener('mousedown', onDown, true)
  window.addEventListener('mouseup', onUp, true)
  document.addEventListener('selectionchange', onSel, true)

  const originalDispatch = view.dispatch.bind(view)
  view.dispatch = (tr) => {
    const input = (view as unknown as { input: ViewInput }).input
    sample.dispatches.push({
      t: performance.now() - t0,
      pointerMeta: !!tr.getMeta('pointer'),
      selectionSet: tr.selectionSet,
      sinceOrigin: Date.now() - input.lastSelectionTime,
      origin: input.lastSelectionOrigin,
    })
    originalDispatch(tr)
  }

  try {
    const pos = findText(fixture.doc, 'bold')
    const coords = side === 'left' ? view.coordsAtPos(pos, 1) : view.coordsAtPos(pos + 4, -1)
    const x = side === 'left' ? coords.left + 1 : coords.right - 1
    const y = (coords.top + coords.bottom) / 2
    const editorRect = view.dom.getBoundingClientRect()
    t0 = performance.now()
    await userEvent.click(pmRoot, { position: { x: x - editorRect.left, y: y - editorRect.top } })
    sample.clickRoundTrip = performance.now() - t0
    sample.snapshot = fixture.selectionSnapshot
    sample.ok =
      side === 'left'
        ? sample.snapshot === 'foo ⎦**bold** bar'
        : sample.snapshot === 'foo **bold**⎣ bar'
  } finally {
    window.removeEventListener('mousedown', onDown, true)
    window.removeEventListener('mouseup', onUp, true)
    document.removeEventListener('selectionchange', onSel, true)
  }
  return sample
}

function getWebGLRenderer(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl')
    if (!gl) return 'no webgl'
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'no debug info'
  } catch (error) {
    return `error: ${String(error)}`
  }
}

async function sampleFrames(count: number): Promise<number[]> {
  const stamps: number[] = []
  await new Promise<void>((resolve) => {
    const tick = (now: number) => {
      stamps.push(now)
      if (stamps.length > count) resolve()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  return stamps.slice(1).map((t, i) => t - stamps[i])
}

async function sampleTimers(delay: number, count: number): Promise<number[]> {
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    const start = performance.now()
    await new Promise((resolve) => setTimeout(resolve, delay))
    result.push(performance.now() - start)
  }
  return result
}

describe('probe: pointer origin window', () => {
  it('samples runner health', { timeout: 600_000, retry: 0 }, async () => {
    const health = {
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      devicePixelRatio: window.devicePixelRatio,
      webglRenderer: getWebGLRenderer(),
      frameIntervals: await sampleFrames(120),
      timeout0: await sampleTimers(0, 50),
      timeout50: await sampleTimers(50, 30),
    }
    await commands.writeFile(`${OUTPUT_DIR}/health.json`, JSON.stringify(health))
    expect(health.frameIntervals.length).toBe(120)
  })

  it('collects click timings', { timeout: 600_000, retry: 0 }, async () => {
    const samples: Sample[] = []
    for (let i = 0; i < ITERATIONS; i++) {
      samples.push(await runOnce(i, 'left'))
      samples.push(await runOnce(i, 'right'))
    }
    await commands.writeFile(
      `${OUTPUT_DIR}/pointer-origin.json`,
      JSON.stringify({ userAgent: navigator.userAgent, samples }),
    )
    expect(samples.length).toBe(ITERATIONS * 2)
  })
})
