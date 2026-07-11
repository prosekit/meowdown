import { describe, expect, it } from 'vitest'

import { markdownToDoc } from '../converters/md-to-pm.ts'
import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

function serializeToClipboardHTML(fixture: Fixture, markdown: string): string {
  const { editor, view } = fixture
  fixture.set(markdownToDoc(markdown, { nodes: editor.nodes }))
  const doc = view.state.doc
  const slice = doc.slice(0, doc.content.size)
  return view.serializeForClipboard(slice).dom.innerHTML
}

function roundTripThroughClipboard(fixture: Fixture, markdown: string): string {
  const html = serializeToClipboardHTML(fixture, markdown)
  const { n, view } = fixture
  fixture.set(n.doc(n.paragraph()))
  view.pasteHTML(html)
  return docToMarkdown(view.state.doc)
}

describe('list clipboard serializer', () => {
  it('keeps the round task marker in the clipboard HTML', () => {
    using fixture = setupFixture()
    const html = serializeToClipboardHTML(fixture, '+ [ ] Task')
    expect(html).toContain('data-pm-slice')
    expect(html).toContain('data-list-kind="task"')
    expect(html).toContain('data-list-marker="+"')
  })

  it('round-trips a round task', () => {
    using fixture = setupFixture()
    expect(roundTripThroughClipboard(fixture, '+ [ ] Task')).toBe('+ [ ] Task\n')
  })

  it('round-trips a checked round task', () => {
    using fixture = setupFixture()
    expect(roundTripThroughClipboard(fixture, '+ [x] Task')).toBe('+ [x] Task\n')
  })

  it('round-trips a star bullet', () => {
    using fixture = setupFixture()
    expect(roundTripThroughClipboard(fixture, '* item')).toBe('* item\n')
  })

  it('round-trips a parenthesis ordered item', () => {
    using fixture = setupFixture()
    expect(roundTripThroughClipboard(fixture, '3) item')).toBe('3) item\n')
  })

  it('round-trips an uppercase checked task', () => {
    using fixture = setupFixture()
    expect(roundTripThroughClipboard(fixture, '- [X] done')).toBe('- [X] done\n')
  })

  it('round-trips a wide marker gap', () => {
    using fixture = setupFixture()
    expect(roundTripThroughClipboard(fixture, '-   spaced')).toBe('-   spaced\n')
  })

  it('round-trips a square task unchanged', () => {
    using fixture = setupFixture()
    expect(roundTripThroughClipboard(fixture, '- [ ] Task')).toBe('- [ ] Task\n')
  })
})
