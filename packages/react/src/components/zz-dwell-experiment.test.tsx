// DO_NOT_MERGE_ME: measures the wikilink hover dwell race on CI runners.
import '../testing/index.ts'

import type { WikilinkHoverHit } from '@meowdown/core'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

import { hover, unhover } from '../testing/mouse.ts'
import { resolveWikilinkAlias } from '../testing/resolve-wikilink-alias.ts'

import { MeowdownEditor } from './editor.tsx'
import { WikilinkHoverCard } from './wikilink-hover-card.tsx'

const pmRoot = page.locate('.ProseMirror')
const card = page.getByTestId('wikilink-hover-card')
const MARKDOWN = '[[Alpha|A wide alias]][[Beta|Another wide alias]]'
const N = 20
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function renderBody(hit: WikilinkHoverHit) {
  return <div data-testid="hover-body">Preview: {hit.target}</div>
}

/**
 * Records, in page time, when the pointer first entered each link and every
 * distinct text the card showed after it mounted.
 */
function observe(alpha: Element, beta: Element) {
  const enter: { alpha?: number; beta?: number } = {}
  const onOver = (event: MouseEvent) => {
    const target = event.target as Node
    if (enter.alpha == null && alpha.contains(target)) enter.alpha = performance.now()
    if (enter.beta == null && beta.contains(target)) enter.beta = performance.now()
  }
  document.addEventListener('mouseover', onOver, {capture: true})
  const shown: { t: number; text: string }[] = []
  const observer = new MutationObserver(() => {
    const element = card.query()
    if (!element) return
    const text = element.textContent ?? ''
    if (shown.at(-1)?.text !== text) shown.push({ t: performance.now(), text })
  })
  observer.observe(document.body, { subtree: true, childList: true, characterData: true })
  return {
    enter,
    shown,
    stop: () => {
      document.removeEventListener('mouseover', onOver, true)
      observer.disconnect()
    },
  }
}

async function setup(openDelay?: number, onBody?: (hit: WikilinkHoverHit) => void) {
  await unhover()
  const body = (hit: WikilinkHoverHit) => {
    onBody?.(hit)
    return renderBody(hit)
  }
  await render(
    <MeowdownEditor
      initialMarkdown={MARKDOWN}
      resolveWikilink={resolveWikilinkAlias}
      blockHandle={false}
    >
      <WikilinkHoverCard openDelay={openDelay}>{body}</WikilinkHoverCard>
    </MeowdownEditor>,
  )
  const links = pmRoot.getByTestId('wikilink')
  await expect.element(links.nth(1)).toBeVisible()
  return { links, alpha: links.nth(0).element(), beta: links.nth(1).element() }
}

describe('probe: current test with timestamps', () => {
  for (let i = 0; i < 10; i++) {
    it(`probe #${i}`, { retry: 0 }, async () => {
      const { links, alpha, beta } = await setup()
      const rec = observe(alpha, beta)
      const t0 = performance.now()
      await hover(links.nth(0))
      const t1 = performance.now()
      await sleep(200)
      const t2 = performance.now()
      await hover(links.nth(1))
      const t3 = performance.now()
      await sleep(150)
      const t4 = performance.now()
      const presentAtCheck = card.query()?.textContent ?? null
      await expect.element(card, { timeout: 3000 }).toHaveTextContent('Preview: Beta')
      rec.stop()
      const r = (v: number | undefined) => (v == null ? null : Math.round(v))
      const data = {
        hoverA: r(t1 - t0),
        alphaEnterToHoverAReturn: r(t1 - rec.enter.alpha!),
        sleep200: r(t2 - t1),
        hoverB: r(t3 - t2),
        hoverBCallToBetaEnter: r(rec.enter.beta! - t2),
        gapAlphaToBeta: r(rec.enter.beta! - rec.enter.alpha!),
        sleep150: r(t4 - t3),
        betaEnterToCheck: r(t4 - rec.enter.beta!),
        presentAtCheck,
        shown: rec.shown.map((s) => ({ afterBetaEnter: r(s.t - rec.enter.beta!), text: s.text })),
      }
      throw new Error(`PROBE ${JSON.stringify(data)}`)
    })
  }
})

describe('baseline: current test, no retry', () => {
  for (let i = 0; i < N; i++) {
    it(`baseline #${i}`, { retry: 0 }, async () => {
      const { links } = await setup()
      await hover(links.nth(0))
      await sleep(200)
      await hover(links.nth(1))
      await sleep(150)
      await expect.element(card, { timeout: 1000 }).not.toBeInTheDocument()
      await expect.element(card, { timeout: 1000 }).toHaveTextContent('Preview: Beta')
    })
  }
})

describe('candidate A: observed targets + in-page timing, 100ms on Alpha', () => {
  for (let i = 0; i < N; i++) {
    it(`candidate A #${i}`, { retry: 0 }, async () => {
      const targets: string[] = []
      const { links, alpha, beta } = await setup(undefined, (hit) => targets.push(hit.target))
      const rec = observe(alpha, beta)
      await hover(links.nth(0))
      await sleep(100)
      await hover(links.nth(1))
      await expect.element(card, { timeout: 2000 }).toHaveTextContent('Preview: Beta')
      rec.stop()
      expect(targets).not.toContain('Alpha')
      expect(targets).toContain('Beta')
      const opened = rec.shown[0].t - rec.enter.beta!
      expect(
        opened,
        `card opened ${Math.round(opened)}ms after entering Beta`,
      ).toBeGreaterThanOrEqual(250)
    })
  }
})

describe('candidate B: observed targets only, immediate move', () => {
  for (let i = 0; i < N; i++) {
    it(`candidate B #${i}`, { retry: 0 }, async () => {
      const targets: string[] = []
      const { links } = await setup(undefined, (hit) => targets.push(hit.target))
      await hover(links.nth(0))
      await hover(links.nth(1))
      await expect.element(card, { timeout: 2000 }).toHaveTextContent('Preview: Beta')
      expect(targets).not.toContain('Alpha')
      expect(targets).toContain('Beta')
    })
  }
})

describe('candidate C: openDelay prop = 1000, current assertions scaled', () => {
  for (let i = 0; i < N; i++) {
    it(`candidate C #${i}`, { retry: 0 }, async () => {
      const { links } = await setup(1000)
      await hover(links.nth(0))
      await sleep(600)
      await hover(links.nth(1))
      await sleep(500)
      await expect.element(card, { timeout: 1000 }).not.toBeInTheDocument()
      await expect.element(card, { timeout: 2000 }).toHaveTextContent('Preview: Beta')
    })
  }
})
