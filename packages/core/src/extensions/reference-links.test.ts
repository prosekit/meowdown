import { getMarkType } from '@prosekit/core'
import type { EditorNode } from '@prosekit/pm/model'
import { describe, expect, it } from 'vitest'

import { findText } from '../testing/find-text.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

function hrefAt(doc: EditorNode, needle: string): string | undefined {
  const node = doc.nodeAt(findText(doc, needle))
  const mark = node?.marks.find((candidate) => candidate.type.name === 'mdLinkText')
  return mark?.attrs.href
}

describe('reference links', () => {
  function setupDoc(...paragraphTexts: string[]): Fixture {
    const fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(...paragraphTexts.map((text) => n.paragraph(text))))
    return fixture
  }

  it('resolves a shortcut reference', () => {
    using fixture = setupDoc('Read [alpha] here.', '[alpha]: https://a.test')
    expect(hrefAt(fixture.doc, 'alpha')).toBe('https://a.test')
  })

  it('resolves a full reference', () => {
    using fixture = setupDoc('See [text here][alpha] now.', '[alpha]: https://a.test')
    expect(hrefAt(fixture.doc, 'text here')).toBe('https://a.test')
  })

  it('resolves a collapsed reference', () => {
    using fixture = setupDoc('See [beta][] now.', '[beta]: https://b.test')
    expect(hrefAt(fixture.doc, 'beta')).toBe('https://b.test')
  })

  it('matches labels case-insensitively', () => {
    using fixture = setupDoc('Read [Alpha] here.', '[alpha]: https://a.test')
    expect(hrefAt(fixture.doc, 'Alpha')).toBe('https://a.test')
  })

  it('marks the full reference label as syntax', () => {
    using fixture = setupDoc('See [text here][alpha] now.', '[alpha]: https://a.test')
    const labelNode = fixture.doc.nodeAt(findText(fixture.doc, '[alpha]'))
    const names = labelNode?.marks.map((mark) => mark.type.name).sort()
    expect(names).toEqual(['mdMark', 'mdPack'])
  })

  it('keeps an unresolved reference as plain text', () => {
    using fixture = setupDoc('Read [gamma] and [delta][nope].')
    expect(hrefAt(fixture.doc, 'gamma')).toBeUndefined()
    expect(hrefAt(fixture.doc, 'delta')).toBeUndefined()
  })

  it('keeps the definition label unlinked', () => {
    using fixture = setupDoc('Read [alpha] here.', '[alpha]: https://a.test')
    expect(hrefAt(fixture.doc, '[alpha]:')).toBeUndefined()
  })

  it('lets the first definition win', () => {
    using fixture = setupDoc(
      'Read [alpha].',
      '[alpha]: https://first.test',
      '[alpha]: https://second.test',
    )
    expect(hrefAt(fixture.doc, 'alpha')).toBe('https://first.test')
  })

  it('resolves an empty destination', () => {
    using fixture = setupDoc('Read [foo] here.', '[foo]: <>')
    expect(hrefAt(fixture.doc, 'foo')).toBe('')
  })

  it('renders a reference image', () => {
    using fixture = setupDoc('See ![moon pic][moon].', '[moon]: https://img.test/moon.jpg')
    const imageNode = fixture.doc.nodeAt(findText(fixture.doc, 'moon pic'))
    const imageMark = imageNode?.marks.find((mark) => mark.type.name === 'mdImage')
    expect(imageMark?.attrs.src).toBe('https://img.test/moon.jpg')
  })

  it('ignores a definition inside a blockquote', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(n.paragraph('Read [alpha].'), n.blockquote(n.paragraph('[alpha]: https://quoted.test'))),
    )
    expect(hrefAt(fixture.doc, 'alpha')).toBeUndefined()
  })

  it('updates citing links when the definition URL changes', () => {
    using fixture = setupDoc('Read [alpha] here.', '[alpha]: https://a.test')
    const { editor } = fixture
    const urlEnd = findText(fixture.doc, 'https://a.test') + 'https://a.test'.length
    editor.view.dispatch(editor.state.tr.insertText('x', urlEnd))
    expect(hrefAt(fixture.doc, 'alpha')).toBe('https://a.testx')
  })

  it('unresolves citing links when the definition is deleted', () => {
    using fixture = setupDoc('Read [alpha] here.', '[alpha]: https://a.test')
    const { editor } = fixture
    const definition = fixture.doc.child(fixture.doc.childCount - 1)
    const definitionStart = fixture.doc.content.size - definition.nodeSize
    editor.view.dispatch(editor.state.tr.delete(definitionStart, fixture.doc.content.size))
    expect(hrefAt(fixture.doc, 'alpha')).toBeUndefined()
  })

  it('resolves after a definition is created later', () => {
    using fixture = setupDoc('Read [alpha] here.')
    const { editor, n } = fixture
    expect(hrefAt(fixture.doc, 'alpha')).toBeUndefined()
    const definition = n.paragraph('[alpha]: https://late.test')
    editor.view.dispatch(editor.state.tr.insert(editor.state.doc.content.size, definition))
    expect(hrefAt(fixture.doc, 'alpha')).toBe('https://late.test')
  })

  it('survives an external AddMarkStep across the definition', () => {
    using fixture = setupDoc('Read [alpha] here.', '[alpha]: https://a.test')
    const { editor } = fixture
    const definitionStart = findText(fixture.doc, '[alpha]:')
    const strong = getMarkType(fixture.schema, 'mdStrong').create()
    editor.view.dispatch(editor.state.tr.addMark(definitionStart, definitionStart + 7, strong))
    expect(hrefAt(fixture.doc, 'alpha')).toBe('https://a.test')
    const sentenceEnd = findText(fixture.doc, 'here.') + 'here.'.length
    editor.view.dispatch(editor.state.tr.insertText('!', sentenceEnd))
    expect(hrefAt(fixture.doc, 'alpha')).toBe('https://a.test')
  })
})
