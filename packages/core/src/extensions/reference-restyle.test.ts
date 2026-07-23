import type { EditorNode } from '@prosekit/pm/model'
import { describe, expect, it, vi } from 'vitest'

import { findText } from '../testing/find-text.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import { flushPendingRestyle, getCacheStats, resetCacheStats } from './inline-mark-plugin.ts'
import type { MdLinkTextAttrs } from './inline-marks.ts'
import { isMarkOfType } from './mark-names.ts'

function hrefAt(doc: EditorNode, needle: string): string | undefined {
  const node = doc.nodeAt(findText(doc, needle))
  const mark = node?.marks.find((candidate) => isMarkOfType(candidate, 'mdLinkText'))
  return (mark?.attrs as MdLinkTextAttrs | undefined)?.href
}

describe('deferred reference restyle', () => {
  function typeAt(fixture: Fixture, pos: number, text: string): void {
    const { editor } = fixture
    editor.view.dispatch(editor.state.tr.insertText(text, pos))
  }

  function setupCitingDoc(citingCount: number): Fixture {
    const fixture = setupFixture()
    const { n } = fixture
    const citing = Array.from({ length: citingCount }, (_, index) =>
      n.paragraph(`Cited ${index} points at [alpha] mid-sentence.`),
    )
    fixture.set(n.doc(...citing, n.paragraph('[alpha]: https://a.test')))
    return fixture
  }

  it('resolves references synchronously in the mount pass', () => {
    using fixture = setupCitingDoc(1)
    expect(hrefAt(fixture.doc, 'alpha')).toBe('https://a.test')
  })

  it('keeps citing blocks on the old href until the flush', async () => {
    using fixture = setupCitingDoc(1)
    const urlEnd = findText(fixture.doc, 'https://a.test') + 'https://a.test'.length
    typeAt(fixture, urlEnd, 'x')
    // The keystroke itself must not restyle the citing block.
    expect(hrefAt(fixture.doc, 'alpha')).toBe('https://a.test')
    await vi.waitFor(() => {
      expect(hrefAt(fixture.doc, 'alpha')).toBe('https://a.testx')
    })
  })

  it('coalesces a keystroke burst into one restyle pass', async () => {
    using fixture = setupCitingDoc(5)
    let pos = findText(fixture.doc, 'https://a.test') + 'https://a.test'.length
    resetCacheStats()
    for (let i = 0; i < 10; i++) {
      typeAt(fixture, pos, 'x')
      pos += 1
    }
    await vi.waitFor(() => {
      expect(hrefAt(fixture.doc, 'alpha')).toBe('https://a.test' + 'x'.repeat(10))
    })
    // 10 keystrokes re-parse the edited definition block once each; the
    // single flush re-parses the 5 citing blocks and the definition block
    // once. A synchronous restyle would have paid 10 x 5 citing parses.
    expect(getCacheStats().parses).toBeLessThanOrEqual(10 + 5 + 2)
  })

  it('flushes deterministically through the test helper', () => {
    using fixture = setupCitingDoc(1)
    const urlEnd = findText(fixture.doc, 'https://a.test') + 'https://a.test'.length
    typeAt(fixture, urlEnd, 'x')
    flushPendingRestyle(fixture.editor.view)
    expect(hrefAt(fixture.doc, 'alpha')).toBe('https://a.testx')
  })

  it('defers linkifying when a definition is created', async () => {
    using fixture = setupFixture()
    const { n, editor } = fixture
    fixture.set(n.doc(n.paragraph('Read [alpha] here.')))
    const definition = n.paragraph('[alpha]: https://late.test')
    editor.view.dispatch(editor.state.tr.insert(editor.state.doc.content.size, definition))
    expect(hrefAt(fixture.doc, 'alpha')).toBeUndefined()
    await vi.waitFor(() => {
      expect(hrefAt(fixture.doc, 'alpha')).toBe('https://late.test')
    })
  })
})
