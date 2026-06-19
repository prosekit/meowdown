import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { findText } from '../testing/find-text.ts'
import { getSelectionSnapshot, setupFixture } from '../testing/index.ts'

import { defineImage } from './image.ts'
import { defineMarkMode, type MarkMode } from './mark-mode.ts'

const IMAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="pink"/></svg>'
const IMAGE_URL = `data:image/svg+xml;base64,${btoa(IMAGE_SVG)}`

// A syntax span counts as revealed when the focus decoration (`.show`) lands
// inside it, which is exactly what the production CSS keys off. One decoration
// covers the whole `mdPack`, so counting `.show` spans directly would also count
// the unit's text; scoping to the hidden-syntax spans recovers the marker count.
const revealedMarkers = page.locate(
  '.ProseMirror .md-mark:has(.show), .ProseMirror .md-link-uri:has(.show), .ProseMirror .md-image-source:has(.show)',
)
const pmRoot = page.locate('.ProseMirror')

/** Mount one paragraph in `mode` (caret at `<a>`) and assert how many syntax markers reveal. */
async function expectReveal(mode: MarkMode, text: string, count: number): Promise<void> {
  using fixture = setupFixture()
  fixture.editor.use(defineMarkMode(mode))
  const { n } = fixture
  fixture.set(n.doc(n.paragraph(text)))
  await expect.element(revealedMarkers).toHaveLength(count)
}

/** Mount one paragraph in `mode` and assert what a full-document copy yields (`null` = no serializer). */
function expectClipboard(mode: MarkMode, text: string, expected: string | null): void {
  using fixture = setupFixture()
  fixture.editor.use(defineMarkMode(mode))
  const { n } = fixture
  fixture.set(n.doc(n.paragraph(text)))
  const serialize = fixture.view.someProp('clipboardTextSerializer')
  const { doc } = fixture
  const actual = serialize ? serialize(doc.slice(0, doc.content.size), fixture.view) : null
  expect(actual).toBe(expected)
}

describe('defineMarkMode', () => {
  describe('focus mode', () => {
    it("sets data-mark-mode attribute to 'focus'", async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'focus')
    })

    it('reveals both ** when the cursor is inside **bold**', async () => {
      await expectReveal('focus', 'Hello **<a>bold** end', 2)
    })

    it('reveals nothing when the cursor is in plain text', async () => {
      await expectReveal('focus', 'Hello<a> **bold** end', 0)
    })

    it('reveals only the adjacent marker pair, not unrelated bolds', async () => {
      await expectReveal('focus', '**<a>one** plain **two**', 2)
    })

    it('reveals nested wrappers (***foo***) as 4 markers', async () => {
      await expectReveal('focus', '***<a>foo***', 4)
    })

    it('reveals every link marker when the cursor is in the text', async () => {
      await expectReveal('focus', 'see [<a>docs](http://x.test)', 4)
    })

    it('reveals every link marker when the cursor is in the url', async () => {
      await expectReveal('focus', 'see [docs](http<a>://x.test)', 4)
    })

    it('reveals nothing when the cursor is inside a bare autolink', async () => {
      await expectReveal('focus', 'visit https://exa<a>mple.com now', 0)
    })

    it('reveals the angle brackets when the cursor is inside <url>', async () => {
      await expectReveal('focus', 'a <https://<a>example.com> b', 2)
    })

    it('reveals when the cursor sits right after the closing **', async () => {
      await expectReveal('focus', '**bold**<a> rest', 2)
    })

    it('reveals nothing on a multi-char selection', async () => {
      await expectReveal('focus', '**<a>bold<b>**', 0)
    })

    it('reveals nothing inside a wikilink (the source is atomic, never revealed)', async () => {
      await expectReveal('focus', 'see [[no<a>te]] end', 0)
    })

    it('reveals nothing inside a wikilink next to a markdown link', async () => {
      await expectReveal('focus', '[a](http://x)[[no<a>te]]', 0)
    })

    it('reveals nothing inside a #tag (tags have no syntax to reveal)', async () => {
      await expectReveal('focus', 'Hello #me<a>ow end', 0)
    })

    it('reveals the whole link when the cursor sits right after the closing )', async () => {
      // `[`, `](`, the url and `)` all reveal; the trailing-edge caret used to
      // reveal nothing because `)` carried no triggering mark.
      await expectReveal('focus', 'ABC[link](https://example.com)<a>DEF', 4)
    })

    it('reveals the angle autolink when the cursor sits right after the closing >', async () => {
      await expectReveal('focus', 'a <https://example.com><a> b', 2)
    })

    it('reveals the whole outer unit even when the cursor is in its bold-only region', async () => {
      // Cursor in the leading `bold`, outside the nested italic; the whole unit
      // reveals: both `**` and both inner `*`.
      await expectReveal('focus', '**bo<a>ld *italic* bold**', 4)
    })

    it('reveals only the link the cursor is in, not its adjacent neighbor', async () => {
      await expectReveal('focus', '[a<a>](x)[b](y)', 4)
    })

    it('reveals nothing when the cursor is inside a code block', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      fixture.set(n.doc(n.codeBlock({ language: '' }, '*not<a> italic*')))
      await expect.element(revealedMarkers).toHaveLength(0)
    })

    it('updates the reveal as the cursor moves between paragraphs', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      fixture.set(n.doc(n.paragraph('**<a>alpha** one'), n.paragraph('beta two')))
      await expect.element(revealedMarkers).toHaveLength(2)

      const twoPos = findText(fixture.doc, 'two')
      fixture.view.dispatch(
        fixture.state.tr.setSelection(TextSelection.create(fixture.doc, twoPos)),
      )
      await expect.element(revealedMarkers).toHaveLength(0)
    })

    it('strips syntax from the copied text just like hide mode', () => {
      expectClipboard('focus', 'Hello **bold** end', 'Hello bold end')
    })

    it('wraps a whole link in one pack containing the anchor', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      fixture.set(n.doc(n.paragraph('see [docs](http://x.test)')))
      const pack = pmRoot.locate('.md-pack[data-key="link_http://x.test"]')
      await expect.element(pack.getByRole('link')).toBeInTheDocument()
    })

    it('nests an italic pack inside a bold pack', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      fixture.set(n.doc(n.paragraph('**bold *italic* bold**')))
      const bold = pmRoot.locate('.md-pack[data-key="bold"]')
      await expect.element(bold.locate('.md-pack[data-key="italic"]')).toBeInTheDocument()
    })

    it('wraps an image in a pack while its preview still renders', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineImage({ resolveImageUrl: () => IMAGE_URL }))
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      fixture.set(n.doc(n.paragraph('![alt](pic.png)')))
      const pack = pmRoot.locate('.md-pack[data-key="image_pic.png"]')
      await expect.element(pack.getByTestId('image-preview')).toBeVisible()
    })

    it('preserves marks after pressing backspaces', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      // Caret sits between the space after `**bold**` and the `*italic*`.
      fixture.set(n.doc(n.paragraph('text **bold** <a>*italic* text')))
      fixture.view.focus()

      expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(
        `"text **bold** ▌*italic* text"`,
      )
      await userEvent.keyboard('{Backspace}')
      // TODO: this is a bug. Pressing backspace should not delete **
      expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(
        `"text **bold▌*italic* text"`,
      )
      await userEvent.keyboard('{Backspace}')
      expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(
        `"text **bol▌*italic* text"`,
      )
    })
  })

  describe('hide mode', () => {
    it("sets data-mark-mode attribute to 'hide'", async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('hide'))
      await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'hide')
    })

    it('never reveals markers, even with the cursor inside bold', async () => {
      await expectReveal('hide', 'Hello **<a>bold** end', 0)
    })

    it('never reveals markers with the cursor inside a wikilink', async () => {
      await expectReveal('hide', 'see [[no<a>te]] end', 0)
    })

    it('strips ** from the copied text', () => {
      expectClipboard('hide', 'Hello **bold** end', 'Hello bold end')
    })

    it('strips link [..](..) syntax from the copied text', () => {
      expectClipboard('hide', 'see [docs](http://x.test)', 'see docs')
    })

    it('keeps a bare autolink in the copied text', () => {
      expectClipboard('hide', 'visit https://example.com now', 'visit https://example.com now')
    })

    it('keeps the whole image source so a copied image stays markdown', () => {
      expectClipboard(
        'hide',
        'see ![cat](https://example.com/cat.png) end',
        'see ![cat](https://example.com/cat.png) end',
      )
    })

    it('keeps the whole [[ ]] source in the copied text', () => {
      expectClipboard('hide', 'see [[note]] end', 'see [[note]] end')
    })

    it('keeps #tag verbatim in the copied text', () => {
      expectClipboard('hide', 'Hello #meow end', 'Hello #meow end')
    })
  })

  describe('show mode', () => {
    it("sets data-mark-mode attribute to 'show'", async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('show'))
      await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'show')
    })

    it('never reveals markers (syntax is always visible via CSS, not decorations)', async () => {
      await expectReveal('show', 'Hello **<a>bold** end', 0)
    })

    it('installs no clipboard serializer, so copied text keeps the ** syntax', () => {
      expectClipboard('show', 'Hello **bold** end', null)
    })
  })
})
