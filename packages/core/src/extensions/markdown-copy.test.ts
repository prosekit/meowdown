import { describe, expect, it } from 'vitest'

import { setupFixture } from '../testing/index.ts'

import { defineMarkdownCopy } from './markdown-copy.ts'

describe('copy as markdown', () => {
  it('serializes a copied bullet list to markdown text', () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.editor.use(defineMarkdownCopy())
    fixture.set(
      n.doc(
        n.list({ kind: 'bullet' }, n.paragraph('one')),
        n.list({ kind: 'bullet' }, n.paragraph('two')),
      ),
    )

    const slice = view.state.doc.slice(0, view.state.doc.content.size)
    const text = view.someProp('clipboardTextSerializer', (serialize) => serialize(slice, view))
    expect(text).toBe('- one\n- two')
  })

  it('falls back to inline text for a partial-paragraph copy', () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.editor.use(defineMarkdownCopy())
    fixture.set(n.doc(n.paragraph('hello world')))

    const slice = view.state.doc.slice(1, 6)
    const text = view.someProp('clipboardTextSerializer', (serialize) => serialize(slice, view))
    expect(text).toBe('hello')
  })
})
