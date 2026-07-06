import { createEditor } from '@prosekit/core'
import { DOMParser, DOMSerializer } from '@prosekit/pm/model'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture } from '../testing/index.ts'

import { defineEditorExtension } from './extension.ts'

function setupEditor() {
  const editor = createEditor({ extension: defineEditorExtension() })
  return { editor, schema: editor.schema, n: editor.nodes }
}

describe('horizontal rule marker', () => {
  it('keeps a non-canonical marker through a DOM round-trip', () => {
    const { schema, n } = setupEditor()
    const doc = n.doc(n.horizontalRule({ marker: '***' }))

    const dom = DOMSerializer.fromSchema(schema).serializeFragment(doc.content)
    const container = document.createElement('div')
    container.appendChild(dom)

    const parsed = DOMParser.fromSchema(schema).parse(container)
    expect(parsed.child(0).attrs.marker).toBe('***')
  })

  it('parses a bare foreign hr as a default rule', () => {
    const { schema } = setupEditor()
    const container = document.createElement('div')
    container.innerHTML = '<hr>'

    const parsed = DOMParser.fromSchema(schema).parse(container)
    expect(parsed.child(0).type.name).toBe('horizontalRule')
    expect(parsed.child(0).attrs.marker).toBe(null)
  })
})

describe('horizontal rule input rule in lists', () => {
  it('replaces an otherwise-empty bullet item typed with `- `', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    fixture.view.focus()

    await userEvent.keyboard('- ')
    await userEvent.keyboard('---')
    expect(fixture.doc.toJSON()).toEqual(n.doc(n.horizontalRule(), n.paragraph()).toJSON())
    expect(docToMarkdown(fixture.doc)).toBe('---\n')
  })

  it('replaces an otherwise-empty ordered item typed with `1. `', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    fixture.view.focus()

    await userEvent.keyboard('1. ')
    await userEvent.keyboard('---')
    expect(fixture.doc.toJSON()).toEqual(n.doc(n.horizontalRule(), n.paragraph()).toJSON())
    expect(docToMarkdown(fixture.doc)).toBe('---\n')
  })

  it('replaces an otherwise-empty task item', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'task', checked: false }, n.paragraph('<a>'))))
    fixture.view.focus()

    await userEvent.keyboard('---')
    expect(fixture.doc.toJSON()).toEqual(n.doc(n.horizontalRule(), n.paragraph()).toJSON())
    expect(docToMarkdown(fixture.doc)).toBe('---\n')
  })

  it('replaces only the item under the caret, splitting the list', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.list({ kind: 'bullet' }, n.paragraph('a')),
        n.list({ kind: 'bullet' }, n.paragraph('<a>')),
        n.list({ kind: 'bullet' }, n.paragraph('b')),
      ),
    )
    fixture.view.focus()

    await userEvent.keyboard('---')
    expect(fixture.doc.toJSON()).toEqual(
      n
        .doc(
          n.list({ kind: 'bullet' }, n.paragraph('a')),
          n.horizontalRule(),
          n.list({ kind: 'bullet' }, n.paragraph('b')),
        )
        .toJSON(),
    )
    expect(docToMarkdown(fixture.doc)).toBe('- a\n\n---\n\n- b\n')
  })

  it('keeps a bullet whose second paragraph gets the `---`', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.paragraph('first'), n.paragraph('<a>'))))
    fixture.view.focus()

    await userEvent.keyboard('---')
    expect(fixture.doc.toJSON()).toEqual(
      n
        .doc(n.list({ kind: 'bullet' }, n.paragraph('first'), n.horizontalRule(), n.paragraph()))
        .toJSON(),
    )
    expect(docToMarkdown(fixture.doc)).toBe('- first\n\n  ---\n')
  })

  it('keeps the outer item when a nested empty item gets the `---`', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.list(
          { kind: 'bullet' },
          n.paragraph('foo'),
          n.list({ kind: 'bullet' }, n.paragraph('<a>')),
        ),
      ),
    )
    fixture.view.focus()

    await userEvent.keyboard('---')
    expect(fixture.doc.toJSON()).toEqual(
      n
        .doc(n.list({ kind: 'bullet' }, n.paragraph('foo'), n.horizontalRule(), n.paragraph()))
        .toJSON(),
    )
    expect(docToMarkdown(fixture.doc)).toBe('- foo\n\n  ---\n')
  })

  it('keeps an item whose paragraph still has text after the caret', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.paragraph('<a>x'))))
    fixture.view.focus()

    await userEvent.keyboard('---')
    expect(fixture.doc.toJSON()).toEqual(
      n.doc(n.list({ kind: 'bullet' }, n.horizontalRule(), n.paragraph('x'))).toJSON(),
    )
  })
})
