import { pasteText } from '@prosekit/core/test'
import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture, type Fixture } from '../testing/index.ts'

import { defineEmbedPaste } from './embed-paste.ts'
import { defineImage } from './image.ts'
import { defineLinkPaste, detectLinkUrl } from './link-paste.ts'

const pmRoot = page.locate('.ProseMirror')
const youtubeEmbed = pmRoot.getByTestId('youtube-embed')

const LINK = 'https://example.com/page'
const YT = 'https://youtu.be/aqz-KE-bpKQ'

function useLinkPaste(fixture: Fixture): void {
  fixture.editor.use(defineLinkPaste())
}

describe('detectLinkUrl', () => {
  it.each([
    ['https://example.com/page?q=1', 'https://example.com/page?q=1'],
    ['x-devonthink-item://ABCD-1234', 'x-devonthink-item://ABCD-1234'],
    ['obsidian://open?vault=notes', 'obsidian://open?vault=notes'],
    ['www.example.com', 'https://www.example.com'],
    ['google.com/path', 'https://google.com/path'],
    ['someone@example.com', 'mailto:someone@example.com'],
  ])('accepts a lone URL: %s', (text, href) => {
    expect(detectLinkUrl(text)).toBe(href)
  })

  it('trims surrounding whitespace and newlines', () => {
    expect(detectLinkUrl('  https://example.com\n')).toBe('https://example.com')
  })

  it.each([
    'read https://example.com', // text + url
    'https://a.com https://b.com', // two urls
    'node.js', // not a linkable bare domain
    'plain words',
    '',
    '   ',
  ])('declines %s', (text) => {
    expect(detectLinkUrl(text)).toBeUndefined()
  })
})

describe('paste a URL over a selection', () => {
  it('wraps the selected text as a markdown link', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useLinkPaste(fixture)
    fixture.set(n.doc(n.paragraph('pick <a>this phrase<b> please')))
    pasteText(view, LINK)
    expect(editor.state.doc.textContent).toBe(`pick [this phrase](${LINK}) please`)
  })

  it('leaves the caret after the closing paren', () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    useLinkPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>label<b>')))
    pasteText(view, LINK)
    const { selection } = fixture.state
    expect(selection.empty).toBe(true)
    expect(selection.from).toBe(1 + `[label](${LINK})`.length)
  })

  it('normalizes a www URL to an https href', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useLinkPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>site<b>')))
    pasteText(view, 'www.example.com')
    expect(editor.state.doc.textContent).toBe('[site](https://www.example.com)')
  })

  it('links a custom scheme URI', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useLinkPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>my note<b>')))
    pasteText(view, 'x-cutsom-schema://ABCD-1234')
    expect(editor.state.doc.textContent).toBe('[my note](x-cutsom-schema://ABCD-1234)')
  })

  it('wraps only the trimmed selection, keeping edge whitespace as text', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useLinkPaste(fixture)
    fixture.set(n.doc(n.paragraph('a<a> mid <b>b')))
    pasteText(view, LINK)
    expect(editor.state.doc.textContent).toBe(`a [mid](${LINK}) b`)
  })

  it('one undo restores the plain selected text', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useLinkPaste(fixture)
    fixture.set(n.doc(n.paragraph('pick <a>this<b> please')))
    pasteText(view, LINK)
    expect(editor.state.doc.textContent).toBe(`pick [this](${LINK}) please`)
    editor.commands.undo()
    expect(editor.state.doc.textContent).toBe('pick this please')
  })
})

describe('falls through to a plain paste', () => {
  it('with an empty selection', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useLinkPaste(fixture)
    fixture.set(n.doc(n.paragraph('before <a>')))
    pasteText(view, LINK)
    expect(editor.state.doc.textContent).toBe(`before ${LINK}`)
  })

  it('when the selection spans two blocks', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useLinkPaste(fixture)
    fixture.set(n.doc(n.paragraph('one <a>two'), n.paragraph('three<b> four')))
    pasteText(view, LINK)
    expect(editor.state.doc.textContent).toBe(`one ${LINK} four`)
  })

  it('inside a code block', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useLinkPaste(fixture)
    fixture.set(n.doc(n.codeBlock({ language: 'js' }, 'const <a>x<b> = 1')))
    pasteText(view, LINK)
    expect(editor.state.doc.textContent).toBe(`const ${LINK} = 1`)
  })

  it('when the clipboard is not a lone URL', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useLinkPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>gone<b>')))
    pasteText(view, `read ${LINK}`)
    expect(editor.state.doc.textContent).toBe(`read ${LINK}`)
  })
})

describe('ordering against embed paste', () => {
  function useEmbedThenLinkPaste(fixture: Fixture): void {
    const { editor } = fixture
    editor.use(defineImage({ resolveImageUrl: (src) => src }))
    // Embed paste registered first: without `Priority.high` on link paste,
    // its `handlePaste` would win and the selection would be discarded.
    editor.use(defineEmbedPaste())
    editor.use(defineLinkPaste())
  }

  it('an embeddable URL pasted over a selection becomes a link, not an embed', async () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useEmbedThenLinkPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>talk<b>')))
    pasteText(view, YT)
    expect(editor.state.doc.textContent).toBe(`[talk](${YT})`)
    await expect.element(youtubeEmbed).not.toBeInTheDocument()
  })

  it('an embeddable URL pasted at a caret still embeds', async () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useEmbedThenLinkPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteText(view, YT)
    expect(editor.state.doc.textContent).toBe(`![](${YT})`)
    await expect.element(youtubeEmbed).toBeInTheDocument()
  })
})
