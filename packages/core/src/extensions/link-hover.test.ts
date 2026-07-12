import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

import { defineLinkHoverHandler, type LinkHoverHandler } from './link-hover.ts'

const markdownLink = page.locate('.ProseMirror .md-link')

function applyHoverable(markdown: string, onHoverChange: LinkHoverHandler) {
  const fixture = setupFixture()
  fixture.editor.use(defineLinkHoverHandler(onHoverChange))
  fixture.set(fixture.n.doc(fixture.n.paragraph(markdown)))
  fixture.editor.commands.setMarkMode('hide')
  return fixture
}

describe('Markdown-link hover callback', () => {
  it('keeps the hovered link active through an unrelated transaction', async () => {
    const onHoverChange = vi.fn<LinkHoverHandler>()
    using fixture = applyHoverable('before [Docs](https://example.com)', onHoverChange)

    await markdownLink.hover()
    fixture.view.dispatch(fixture.state.tr.insertText('new ', 1))

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.payload.href)).toEqual([
      'https://example.com',
    ])
  })

  it('leaves when the hovered link is deleted without pointer movement', async () => {
    const onHoverChange = vi.fn<LinkHoverHandler>()
    using fixture = applyHoverable('before [Docs](https://example.com)', onHoverChange)

    await markdownLink.hover()
    fixture.set(fixture.n.doc(fixture.n.paragraph('before Docs')))

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.payload.href)).toEqual([
      'https://example.com',
      undefined,
    ])
  })

  it('leaves when the hovered link destination is replaced', async () => {
    const onHoverChange = vi.fn<LinkHoverHandler>()
    using fixture = applyHoverable('[Docs](https://example.com)', onHoverChange)

    await markdownLink.hover()
    fixture.set(fixture.n.doc(fixture.n.paragraph('[Docs](https://example.org)')))

    expect(onHoverChange.mock.calls.map(([hit]) => hit?.payload.href)).toEqual([
      'https://example.com',
      undefined,
    ])
  })
})
