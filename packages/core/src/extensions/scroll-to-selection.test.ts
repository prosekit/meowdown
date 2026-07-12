import { definePlugin } from '@prosekit/core'
import { Plugin } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'

import { setupFixture, type Fixture } from '../testing/index.ts'

import type { MarkMode } from './mark-mode.ts'

const ALL_MODES: MarkMode[] = ['hide', 'focus', 'show']

// The scroll assertions need a scrollable ancestor; the mount container gets a
// fixed height so a tall document overflows it.
function makeScroller(): HTMLElement {
  const container = document.getElementById('test-container') as HTMLElement
  container.style.height = '200px'
  container.style.overflow = 'auto'
  return container
}

// A document tall enough to scroll: 40 filler paragraphs, then `last`. The
// caret is placed by the `<a>`/`<b>` tags inside `last`.
function setLongDoc(fixture: Fixture, last: string): void {
  const { n } = fixture
  const fillers = Array.from({ length: 40 }, (_, i) => n.paragraph(`filler ${String(i)}`))
  fixture.set(n.doc(...fillers, n.paragraph(last)))
  fixture.view.focus()
}

function dispatchScrollIntoView(fixture: Fixture): void {
  fixture.view.dispatch(fixture.view.state.tr.scrollIntoView())
}

// Vertical containment within the scroller's client box (the same bounds the
// scroll algorithm works against), with a little slack for fractional pixels.
function expectVisibleIn(element: Element, scroller: HTMLElement): void {
  const rect = element.getBoundingClientRect()
  const bounds = scroller.getBoundingClientRect()
  expect(rect.top).toBeGreaterThanOrEqual(bounds.top - 1)
  expect(rect.bottom).toBeLessThanOrEqual(bounds.top + scroller.clientHeight + 1)
}

function wikilinkPreview(fixture: Fixture): Element {
  const preview = fixture.dom.querySelector('.md-wikilink-view-preview')
  if (preview == null) throw new Error('no wikilink preview rendered')
  return preview
}

describe.each(ALL_MODES)('scroll to an atom mark boundary in %s mode', (mode) => {
  it('scrolls to the caret after a trailing wikilink', () => {
    using fixture = setupFixture({ extensionOptions: { markMode: mode } })
    const scroller = makeScroller()
    setLongDoc(fixture, '[[This is a backlink]]<a>')
    scroller.scrollTop = 0
    dispatchScrollIntoView(fixture)
    expect(scroller.scrollTop).toBeGreaterThan(0)
    expectVisibleIn(wikilinkPreview(fixture), scroller)
  })

  it('scrolls to the caret before a leading wikilink', () => {
    using fixture = setupFixture({ extensionOptions: { markMode: mode } })
    const scroller = makeScroller()
    setLongDoc(fixture, '<a>[[This is a backlink]]')
    scroller.scrollTop = 0
    dispatchScrollIntoView(fixture)
    expect(scroller.scrollTop).toBeGreaterThan(0)
    expectVisibleIn(wikilinkPreview(fixture), scroller)
  })

  it('scrolls to the head of a selection that swallowed a wikilink', () => {
    using fixture = setupFixture({ extensionOptions: { markMode: mode } })
    const scroller = makeScroller()
    setLongDoc(fixture, 'before <a>[[This is a backlink]]<b>')
    scroller.scrollTop = 0
    dispatchScrollIntoView(fixture)
    expect(scroller.scrollTop).toBeGreaterThan(0)
    expectVisibleIn(wikilinkPreview(fixture), scroller)
  })

  it('does not scroll while the caret is already visible', () => {
    using fixture = setupFixture({ extensionOptions: { markMode: mode } })
    const { n } = fixture
    const scroller = makeScroller()
    const fillers = Array.from({ length: 40 }, (_, i) => n.paragraph(`filler ${String(i)}`))
    fixture.set(n.doc(n.paragraph('[[This is a backlink]]<a>'), ...fillers))
    fixture.view.focus()
    scroller.scrollTop = 0
    dispatchScrollIntoView(fixture)
    expect(scroller.scrollTop).toBe(0)
  })
})

describe('scroll to a hidden run boundary in hide mode', () => {
  // The trailing `**` keeps a zero-size box, so the head itself measures as a
  // point; the takeover must land on the probe from the run's far end.
  it('scrolls to the caret after trailing hidden syntax', () => {
    using fixture = setupFixture({ extensionOptions: { markMode: 'hide' } })
    const scroller = makeScroller()
    setLongDoc(fixture, 'tail **bold**<a>')
    scroller.scrollTop = 0
    dispatchScrollIntoView(fixture)
    expect(scroller.scrollTop).toBeGreaterThan(0)
    const paragraphs = fixture.dom.querySelectorAll('p')
    expectVisibleIn(paragraphs[paragraphs.length - 1], scroller)
  })
})

describe('the default scroll path', () => {
  it('still scrolls to a plain text caret', () => {
    using fixture = setupFixture({ extensionOptions: { markMode: 'hide' } })
    const scroller = makeScroller()
    setLongDoc(fixture, 'This is just plain text<a>')
    scroller.scrollTop = 0
    dispatchScrollIntoView(fixture)
    expect(scroller.scrollTop).toBeGreaterThan(0)
    const paragraphs = fixture.dom.querySelectorAll('p')
    expectVisibleIn(paragraphs[paragraphs.length - 1], scroller)
  })
})

describe('scrollMargin', () => {
  it('keeps the configured margin below the caret', () => {
    using fixture = setupFixture({ extensionOptions: { markMode: 'hide' } })
    fixture.editor.use(definePlugin(new Plugin({ props: { scrollMargin: 20 } })))
    const scroller = makeScroller()
    setLongDoc(fixture, '[[This is a backlink]]<a>')
    scroller.scrollTop = 0
    dispatchScrollIntoView(fixture)
    const bounds = scroller.getBoundingClientRect()
    const scrollerBottom = bounds.top + scroller.clientHeight
    const gap = scrollerBottom - wikilinkPreview(fixture).getBoundingClientRect().bottom
    expect(Math.abs(gap - 20)).toBeLessThanOrEqual(1.5)
  })
})
