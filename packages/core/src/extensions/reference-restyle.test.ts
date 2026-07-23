import type { EditorNode } from '@prosekit/pm/model'
import { describe, expect, it, vi } from 'vitest'

import { findText } from '../testing/find-text.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import { flushPendingRestyle, getCacheStats, resetCacheStats } from './inline-mark-plugin.ts'
import { isMarkOfType } from './mark-names.ts'

function getLinkHref(doc: EditorNode, label: string): string | undefined {
  const position = findText(doc, label)
  const link = doc
    .resolve(position + 1)
    .marks()
    .find((mark) => isMarkOfType(mark, 'mdLinkText'))
  return typeof link?.attrs.href === 'string' ? link.attrs.href : undefined
}

function insertText(fixture: Fixture, position: number, text: string): void {
  const { editor } = fixture
  editor.view.dispatch(editor.state.tr.insertText(text, position))
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

describe('deferred reference restyle', () => {
  it('resolves references synchronously on mount', () => {
    using fixture = setupCitingDoc(1)
    expect(getLinkHref(fixture.doc, 'alpha')).toBe('https://a.test')
  })

  it('keeps the previous href until the debounce flushes', async () => {
    using fixture = setupCitingDoc(1)
    const urlEnd = findText(fixture.doc, 'https://a.test') + 'https://a.test'.length
    insertText(fixture, urlEnd, 'x')

    expect(getLinkHref(fixture.doc, 'alpha')).toBe('https://a.test')
    await vi.waitFor(() => {
      expect(getLinkHref(fixture.doc, 'alpha')).toBe('https://a.testx')
    })
  })

  it('coalesces a definition-edit burst into one dependent pass', async () => {
    using fixture = setupCitingDoc(5)
    let position = findText(fixture.doc, 'https://a.test') + 'https://a.test'.length
    resetCacheStats()
    for (let index = 0; index < 10; index++) {
      insertText(fixture, position, 'x')
      position++
    }

    await vi.waitFor(() => {
      expect(getLinkHref(fixture.doc, 'alpha')).toBe('https://a.test' + 'x'.repeat(10))
    })
    expect(getCacheStats().parses).toBeLessThanOrEqual(17)
  })

  it('flushes deterministically through the test helper', () => {
    using fixture = setupCitingDoc(1)
    const urlEnd = findText(fixture.doc, 'https://a.test') + 'https://a.test'.length
    insertText(fixture, urlEnd, 'x')
    flushPendingRestyle(fixture.editor.view)
    expect(getLinkHref(fixture.doc, 'alpha')).toBe('https://a.testx')
  })

  it('coalesces changed keys from multiple definitions', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.paragraph('[Alpha][alpha] and [Beta][beta]'),
        n.paragraph('[alpha]: /alpha'),
        n.paragraph('[beta]: /beta'),
      ),
    )

    insertText(fixture, findText(fixture.doc, '/alpha') + '/alpha'.length, '-new')
    insertText(fixture, findText(fixture.doc, '/beta') + '/beta'.length, '-new')
    expect(getLinkHref(fixture.doc, 'Alpha')).toBe('/alpha')
    expect(getLinkHref(fixture.doc, 'Beta')).toBe('/beta')

    flushPendingRestyle(fixture.editor.view)
    expect(getLinkHref(fixture.doc, 'Alpha')).toBe('/alpha-new')
    expect(getLinkHref(fixture.doc, 'Beta')).toBe('/beta-new')
  })

  it('defers references when a container definition appears', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('Read [alpha] here.')))
    const quote = n.blockquote(n.paragraph('[alpha]: https://late.test'))
    editor.view.dispatch(editor.state.tr.insert(editor.state.doc.content.size, quote))

    expect(getLinkHref(fixture.doc, 'alpha')).toBeUndefined()
    await vi.waitFor(() => {
      expect(getLinkHref(fixture.doc, 'alpha')).toBe('https://late.test')
    })
  })
})
