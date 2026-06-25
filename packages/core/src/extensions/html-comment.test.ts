import { createEditor } from '@prosekit/core'
import { DOMParser, DOMSerializer } from '@prosekit/pm/model'
import { describe, expect, it } from 'vitest'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture } from '../testing/index.ts'

import { defineEditorExtension } from './extension.ts'

function setupEditor() {
  const editor = createEditor({ extension: defineEditorExtension() })
  return { editor, schema: editor.schema, n: editor.nodes }
}

describe('html comment node', () => {
  it('serializes to a hidden element and recovers its content from the DOM', () => {
    const { schema, n } = setupEditor()
    const doc = n.doc(n.htmlComment({ content: '<!-- marker -->' }))

    const dom = DOMSerializer.fromSchema(schema).serializeFragment(doc.content)
    const container = document.createElement('div')
    container.appendChild(dom)

    const element = container.querySelector<HTMLElement>('[data-html-comment]')
    expect(element).not.toBeNull()
    expect(element?.style.display).toBe('none')

    const parsed = DOMParser.fromSchema(schema).parse(container)
    expect(parsed.child(0).type.name).toBe('htmlComment')
    expect(parsed.child(0).attrs.content).toBe('<!-- marker -->')
  })
})

describe('html comment in a mounted editor', () => {
  it('renders the comment invisibly without spilling into the visible text', () => {
    using fixture = setupFixture()
    fixture.set(
      fixture.n.doc(
        fixture.n.paragraph('before'),
        fixture.n.htmlComment({ content: '<!-- reflect-capture-page-text:start -->' }),
        fixture.n.paragraph('after'),
      ),
    )

    const element = fixture.dom.querySelector<HTMLElement>('[data-html-comment]')
    expect(element).not.toBeNull()
    expect(getComputedStyle(element as HTMLElement).display).toBe('none')
    // The raw comment must not read as body text in the editor.
    expect(fixture.dom.textContent).not.toContain('reflect-capture-page-text')
    expect(fixture.dom.textContent).toContain('before')
    expect(fixture.dom.textContent).toContain('after')
  })

  it('keeps the comment in the document so it round-trips to markdown', () => {
    using fixture = setupFixture()
    fixture.set(
      fixture.n.doc(
        fixture.n.htmlComment({ content: '<!-- start -->' }),
        fixture.n.paragraph('body text'),
        fixture.n.htmlComment({ content: '<!-- end -->' }),
      ),
    )

    expect(docToMarkdown(fixture.doc)).toBe('<!-- start -->\n\nbody text\n\n<!-- end -->\n')
  })

  it('steps the caret past the hidden comment without error', async () => {
    using fixture = setupFixture()
    fixture.set(
      fixture.n.doc(
        fixture.n.paragraph('first<a>'),
        fixture.n.htmlComment({ content: '<!-- between -->' }),
        fixture.n.paragraph('second'),
      ),
    )
    fixture.view.focus()
    // Arrow-down across the invisible node lands in the next paragraph; the
    // comment survives, proving navigation neither crashes nor drops it.
    const { userEvent } = await import('vitest/browser')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')

    expect(docToMarkdown(fixture.doc)).toBe('first\n\n<!-- between -->\n\nsecond\n')
  })
})
