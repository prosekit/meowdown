import '../testing/index.ts'

import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { commands, page, userEvent } from 'vitest/browser'

import { MeowdownEditor } from './editor.tsx'

const OUTPUT_DIR = String(import.meta.env.VITE_PROBE_OUTPUT_DIR || 'probe-output')
const ITERATIONS = Number(import.meta.env.VITE_PROBE_ITERATIONS || 30)

const popover = page.getByTestId('link-popover')

interface Sample {
  i: number
  // All times are ms since the first mouseover on the link.
  tClickDone: number
  tModK: number
  tFocus: number
  tEscapeSent: number
  tEscapeKeydown?: number
  tAssertDone: number
  // Whether the assertion of the real test held.
  assertOk: boolean
  // DOM timeline of the popover: [ms since mouseover, kind]
  timeline: Array<[number, string]>
  // What the popover shows one second after the assertion settled.
  finalKind: string
}

function popoverKind(): string {
  const el = document.querySelector('[data-testid="link-popover"]')
  if (!el) return 'none'
  if (el.querySelector('[data-testid="link-popover-edit"]')) return 'edit'
  if (el.querySelector('[data-testid="link-popover-info"]')) return 'info'
  return 'other'
}

async function runOnce(i: number): Promise<Sample> {
  const screen = await render(<MeowdownEditor initialMarkdown="[Docs](https://example.com)" />)
  let t0: number | undefined
  const now = () => Math.round(performance.now() - (t0 ?? performance.now()))
  const sample: Sample = {
    i,
    tClickDone: 0,
    tModK: 0,
    tFocus: 0,
    tEscapeSent: 0,
    tAssertDone: 0,
    assertOk: false,
    timeline: [],
    finalKind: '',
  }
  const onOver = (event: MouseEvent) => {
    if (t0 == null && event.target instanceof Element && event.target.closest('.md-link')) {
      t0 = performance.now()
    }
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && sample.tEscapeKeydown == null) sample.tEscapeKeydown = now()
  }
  window.addEventListener('mouseover', onOver, true)
  window.addEventListener('keydown', onKeyDown, true)
  let lastKind = 'none'
  const observer = new MutationObserver(() => {
    const kind = popoverKind()
    if (kind !== lastKind) {
      lastKind = kind
      sample.timeline.push([now(), kind])
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  try {
    // The same steps as `focuses Link on Mod-k and dismisses with Escape`
    // before the `vi.waitFor` wrapper was added.
    await screen.getByText('Docs').click()
    sample.tClickDone = now()
    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}')
    sample.tModK = now()
    await expect.element(popover.getByTestId('link-popover-input')).toHaveFocus()
    sample.tFocus = now()
    await userEvent.keyboard('{Escape}')
    sample.tEscapeSent = now()
    try {
      await expect.element(popover, { timeout: 1_000 }).not.toBeInTheDocument()
      sample.assertOk = true
    } catch {
      sample.assertOk = false
    }
    sample.tAssertDone = now()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    sample.finalKind = popoverKind()
  } finally {
    observer.disconnect()
    window.removeEventListener('mouseover', onOver, true)
    window.removeEventListener('keydown', onKeyDown, true)
    await screen.unmount()
    // Park the pointer away from the next iteration's link.
    await userEvent.hover(page.elementLocator(document.body), { position: { x: 880, y: 580 } })
  }
  return sample
}

describe('probe: Mod-k then Escape', () => {
  it('collects timings', { timeout: 600_000, retry: 0 }, async () => {
    const samples: Sample[] = []
    for (let i = 0; i < ITERATIONS; i++) {
      samples.push(await runOnce(i))
    }
    await commands.writeFile(
      `${OUTPUT_DIR}/modk-escape.json`,
      JSON.stringify({ userAgent: navigator.userAgent, samples }),
    )
    expect(samples.length).toBe(ITERATIONS)
  })
})
