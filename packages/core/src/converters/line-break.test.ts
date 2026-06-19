import { DOMParser } from '@prosekit/pm/model'
import dedent from 'dedent'
import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

import { markdownToDoc } from './md-to-pm.ts'
import { docToMarkdown } from './pm-to-md.ts'

const roundtrip = (markdown: string) => docToMarkdown(markdownToDoc(markdown))

describe('markdown soft line breaks survive as hardBreak nodes', () => {
  it('parses a soft break into a hardBreak node, not a raw newline', () => {
    const doc = markdownToDoc('text\ntext')
    const paragraph = doc.child(0)
    expect(paragraph.childCount).toBe(3)
    expect(paragraph.child(0).text).toBe('text')
    expect(paragraph.child(1).type.name).toBe('hardBreak')
    expect(paragraph.child(2).text).toBe('text')
    // The hardBreak's one-char `\n` leafText keeps inline offsets aligned.
    expect(paragraph.textContent).toBe('text\ntext')
  })

  it('round-trips a soft break byte-for-byte', () => {
    expect(roundtrip('text\ntext')).toBe('text\ntext\n')
    expect(roundtrip('a\nsdas\ns')).toBe('a\nsdas\ns\n')
    expect(roundtrip('- [ ] a\nb')).toBe('- [ ] a\n  b\n')
  })

  it('renders as a <br> that ProseMirror can re-parse without collapsing', () => {
    using fixture = setupFixture()
    const { editor } = fixture
    fixture.set(markdownToDoc('text\ntext', editor.nodes))
    const paragraphDom = editor.view.dom.querySelector('p')
    if (!paragraphDom) throw new Error('no <p>')
    expect(paragraphDom.querySelector('br')).not.toBeNull()
    // Re-parsing the DOM is exactly what `readDOMChange` does; before the fix
    // (a raw `\n` text node) this collapsed the newline to a space.
    const reparsed = DOMParser.fromSchema(editor.schema).parse(paragraphDom)
    expect(reparsed.textContent).toBe('text\ntext')
  })

  it('keeps the break in the model after a real paint (reflect-open regression)', async () => {
    using fixture = setupFixture()
    const { editor } = fixture
    fixture.set(markdownToDoc('text\ntext\n\n- [ ] task', editor.nodes))
    expect(docToMarkdown(editor.view.state.doc)).toBe('text\ntext\n\n- [ ] task\n')
    // A screenshot forces a real browser paint, the DOM re-read that used to
    // turn the newline into a space. `save: false` keeps it off disk.
    await page.screenshot({ base64: true, save: false })
    expect(docToMarkdown(editor.view.state.doc)).toBe('text\ntext\n\n- [ ] task\n')
  })

  it('keeps soft breaks across the full screenshot document', () => {
    const full = dedent`
      text
      text

      - [x] dasdasda
        - [ ] dasdasdasdas
      - [ ] asdasa

      a
      sdas
      s

      heading

      - dasdasd
        - adasdas
      - [ ] Task
      - Bullet
    `
    expect(roundtrip(full)).toBe(full + '\n')
  })
})
