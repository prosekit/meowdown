import { isApple } from '@prosekit/core'
import { pasteText } from '@prosekit/core/test'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import { defineEmbedPaste, detectEmbedUrl } from './embed-paste.ts'
import { defineImage } from './image.ts'

const pmRoot = page.locate('.ProseMirror')
const youtubeEmbed = pmRoot.getByTestId('youtube-embed')
const tweetEmbed = pmRoot.getByTestId('tweet-embed')

const YT = 'https://youtu.be/aqz-KE-bpKQ'
const EMBED = `![](${YT})`

function useEmbedPaste(fixture: Fixture): void {
  const { editor } = fixture
  editor.use(defineImage({ resolveImageUrl: (src) => src }))
  editor.use(defineEmbedPaste())
}

describe('detectEmbedUrl', () => {
  it.each([
    'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    'https://youtu.be/aqz-KE-bpKQ',
    'https://www.youtube.com/shorts/aqz-KE-bpKQ',
    'https://twitter.com/jack/status/20',
    'https://x.com/jack/status/20',
  ])('accepts a lone embed URL: %s', (src) => {
    expect(detectEmbedUrl(src)).toBe(src)
  })

  it('trims surrounding whitespace and newlines', () => {
    expect(detectEmbedUrl('  https://youtu.be/aqz-KE-bpKQ\n')).toBe('https://youtu.be/aqz-KE-bpKQ')
  })

  it.each([
    'watch https://youtu.be/aqz-KE-bpKQ', // text + url
    'https://youtu.be/aqz-KE-bpKQ https://x.com/jack/status/20', // two urls
    'https://example.com/cat.png', // plain image
    'https://twitter.com/jack', // profile, not a status
    'https://example.com', // not embeddable
    '',
    '   ',
  ])('declines %s', (text) => {
    expect(detectEmbedUrl(text)).toBeUndefined()
  })
})

describe('paste a lone embed link', () => {
  it('embeds a pasted YouTube link', async () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useEmbedPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteText(view, 'https://www.youtube.com/watch?v=aqz-KE-bpKQ')
    expect(docToMarkdown(editor.state.doc).trim()).toBe(
      '![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)',
    )
    await expect
      .element(youtubeEmbed)
      .toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ')
  })

  it('embeds a pasted tweet link', async () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useEmbedPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteText(view, 'https://twitter.com/jack/status/20')
    expect(editor.state.doc.textContent).toBe('![](https://twitter.com/jack/status/20)')
    await expect.element(tweetEmbed).toBeInTheDocument()
  })

  it('replaces the selected text when pasting onto a selection', async () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useEmbedPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>drop me<b>')))
    pasteText(view, YT)
    expect(editor.state.doc.textContent).toBe(EMBED)
    await expect.element(youtubeEmbed).toBeInTheDocument()
  })

  it('leaves a non-embeddable URL as a normal paste', async () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useEmbedPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteText(view, 'https://example.com')
    expect(editor.state.doc.textContent).toBe('https://example.com')
    await expect.element(youtubeEmbed).not.toBeInTheDocument()
  })

  it('does not embed when the clipboard has text around the URL', async () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useEmbedPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteText(view, `see ${YT}`)
    expect(editor.state.doc.textContent).toBe(`see ${YT}`)
    await expect.element(youtubeEmbed).not.toBeInTheDocument()
  })

  it('does not embed inside a code block', async () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useEmbedPaste(fixture)
    fixture.set(n.doc(n.codeBlock({ language: 'js' }, 'const x = 1<a>')))
    pasteText(view, YT)
    expect(editor.state.doc.textContent).toBe(`const x = 1${YT}`)
    await expect.element(youtubeEmbed).not.toBeInTheDocument()
  })

  it('embeds over a selection that spans two blocks', async () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useEmbedPaste(fixture)
    fixture.set(n.doc(n.paragraph('one <a>two'), n.paragraph('three<b> four')))
    pasteText(view, YT)
    expect(editor.state.doc.textContent).toBe(`one ${EMBED} four`)
    await expect.element(youtubeEmbed).toBeInTheDocument()
  })
})

describe('undo restores the raw link', () => {
  it('one undo turns the embed back into the link, a second removes it', async () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useEmbedPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>')))

    pasteText(view, YT)
    expect(editor.state.doc.textContent).toBe(EMBED)
    await expect.element(youtubeEmbed).toBeInTheDocument()

    // First undo: embed -> raw link. The iframe is gone; the URL text remains.
    editor.commands.undo()
    expect(editor.state.doc.textContent).toBe(YT)
    await expect.element(youtubeEmbed).not.toBeInTheDocument()

    // Second undo: link -> empty (pre-paste).
    editor.commands.undo()
    expect(editor.state.doc.textContent).toBe('')

    // Redo mirrors it: link, then embed.
    editor.commands.redo()
    expect(editor.state.doc.textContent).toBe(YT)
    editor.commands.redo()
    expect(editor.state.doc.textContent).toBe(EMBED)
    await expect.element(youtubeEmbed).toBeInTheDocument()
  })

  it('takes exactly two undo steps (proves the two-transaction split)', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useEmbedPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteText(view, YT)
    editor.commands.undo()
    // Still the raw link, not empty: one undo must not jump straight to pre-paste.
    expect(editor.state.doc.textContent).toBe(YT)
  })

  it('keeps the surrounding text, removing only the pasted link', () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useEmbedPaste(fixture)
    fixture.set(n.doc(n.paragraph('before <a>')))
    pasteText(view, YT)
    expect(editor.state.doc.textContent).toBe(`before ${EMBED}`)
    editor.commands.undo()
    expect(editor.state.doc.textContent).toBe(`before ${YT}`)
    editor.commands.undo()
    expect(editor.state.doc.textContent).toBe('before ')
  })

  it('reverts via the real Ctrl-z / Cmd-z shortcut', async () => {
    using fixture = setupFixture()
    const { editor, n, view } = fixture
    useEmbedPaste(fixture)
    fixture.set(n.doc(n.paragraph('<a>')))
    pasteText(view, YT)
    await expect.element(youtubeEmbed).toBeInTheDocument()

    view.focus()
    // `Mod-z` is bound to undo by defineHistory; exercise the actual binding.
    // TODO: rewrite this to {ControlOrMeta}
    await userEvent.keyboard(
      `{${isApple ? 'Meta' : 'Control'}>}z{/${isApple ? 'Meta' : 'Control'}}`,
    )
    expect(editor.state.doc.textContent).toBe(YT)
    await expect.element(youtubeEmbed).not.toBeInTheDocument()
  })
})
