import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { findText } from '../testing/find-text.ts'
import { getSelectionSnapshot, setupFixture, type Fixture } from '../testing/index.ts'

import { defineImage } from './image.ts'
import type { MarkMode } from './mark-mode.ts'
import { defineMarkMode } from './mark-mode.ts'

const IMAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="pink"/></svg>'
const IMAGE_URL = `data:image/svg+xml;base64,${btoa(IMAGE_SVG)}`

// A syntax span counts as revealed when the focus decoration (`.show`) lands
// inside it, which is exactly what the production CSS keys off. One decoration
// now covers the whole `mdPack`, so counting `.show` spans directly would also
// count the unit's text; scoping to the hidden-syntax spans recovers the marker
// count.
const revealedMarkers = page.locate(
  '.ProseMirror .md-mark:has(.show), .ProseMirror .md-link-uri:has(.show), .ProseMirror .md-image-source:has(.show)',
)
const pmRoot = page.locate('.ProseMirror')

/** Asserts how many syntax markers are revealed (made visible by the `.show` decoration). */
async function expectRevealedMarkers(count: number): Promise<void> {
  await expect.element(revealedMarkers).toHaveLength(count)
}

/** What a full-document copy would put on the clipboard, or `null` if the mode installs no serializer. */
function clipboardText(fixture: Fixture): string | null {
  const serialize = fixture.view.someProp('clipboardTextSerializer')
  if (!serialize) return null
  const { doc } = fixture
  return serialize(doc.slice(0, doc.content.size), fixture.view)
}

describe('defineMarkMode', () => {
  it('set data-mark-mode attribute', async () => {
    async function expectDataMarkMode(markMode: MarkMode) {
      using fixture = setupFixture()
      const { n, editor } = fixture
      editor.use(defineMarkMode(markMode))
      const doc = n.doc(n.paragraph('a'))
      fixture.set(doc)
      await expect.element(pmRoot).toHaveAttribute('data-mark-mode', markMode)
    }

    await expectDataMarkMode('focus')
    await expectDataMarkMode('hide')
    await expectDataMarkMode('show')
  })

  describe('focus mode', () => {
    it('reveals both ** when the cursor is inside **bold**', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('Hello **<a>bold** end'))
      fixture.set(doc)
      await expectRevealedMarkers(2)
    })

    it('reveals nothing when the cursor is in plain text', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('Hello<a> **bold** end'))
      fixture.set(doc)
      await expectRevealedMarkers(0)
    })

    it('reveals only the adjacent marker pair, not unrelated bolds', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('**<a>one** plain **two**'))
      fixture.set(doc)
      await expectRevealedMarkers(2)
    })

    it('reveals nested wrappers (***foo***) as 4 markers', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('***<a>foo***'))
      fixture.set(doc)
      await expectRevealedMarkers(4)
    })

    it('reveals every link marker when the cursor is in the text', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('see [<a>docs](http://x.test)'))
      fixture.set(doc)
      await expectRevealedMarkers(4)
    })

    it('reveals every link marker when the cursor is in the url', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('see [docs](http<a>://x.test)'))
      fixture.set(doc)
      await expectRevealedMarkers(4)
    })

    it('reveals nothing when the cursor is inside a bare autolink', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('visit https://exa<a>mple.com now'))
      fixture.set(doc)
      await expectRevealedMarkers(0)
    })

    it('reveals the angle brackets when the cursor is inside <url>', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('a <https://<a>example.com> b'))
      fixture.set(doc)
      await expectRevealedMarkers(2)
    })

    it('reveals when the cursor sits right after the closing **', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('**bold**<a> rest'))
      fixture.set(doc)
      await expectRevealedMarkers(2)
    })

    it('reveals nothing on a multi-char selection', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('**<a>bold<b>**'))
      fixture.set(doc)
      await expectRevealedMarkers(0)
    })

    it('reveals nothing inside a wikilink (the source is atomic, never revealed)', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('see [[no<a>te]] end'))
      fixture.set(doc)
      await expectRevealedMarkers(0)
    })

    it('reveals nothing inside a wikilink next to a markdown link', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('[a](http://x)[[no<a>te]]'))
      fixture.set(doc)
      await expectRevealedMarkers(0)
    })

    it('reveals nothing inside a #tag (tags have no syntax to reveal)', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('Hello #me<a>ow end'))
      fixture.set(doc)
      await expectRevealedMarkers(0)
    })

    it('reveals nothing when the cursor is inside a code block', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.codeBlock({ language: '' }, '*not<a> italic*'))
      fixture.set(doc)
      await expectRevealedMarkers(0)
    })

    it('updates the reveal as the cursor moves between paragraphs', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('**<a>alpha** one'), n.paragraph('beta two'))
      fixture.set(doc)
      await expectRevealedMarkers(2)

      const twoPos = findText(fixture.doc, 'two')
      fixture.view.dispatch(
        fixture.state.tr.setSelection(TextSelection.create(fixture.doc, twoPos)),
      )
      await expectRevealedMarkers(0)
    })

    it('reveals the whole link when the cursor sits right after the closing )', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('ABC[link](https://example.com)<a>DEF'))
      fixture.set(doc)
      // `[`, `](`, the url and `)` all reveal; the trailing-edge caret used to
      // reveal nothing because `)` carried no triggering mark.
      await expectRevealedMarkers(4)
    })

    it('reveals the angle autolink when the cursor sits right after the closing >', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('a <https://example.com><a> b'))
      fixture.set(doc)
      await expectRevealedMarkers(2)
    })

    it('reveals the whole outer unit even when the cursor is in its bold-only region', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      // Cursor in the leading `bold`, outside the nested italic. The whole unit
      // reveals: both `**` and both inner `*` (4 markers).
      const doc = n.doc(n.paragraph('**bo<a>ld *italic* bold**'))
      fixture.set(doc)
      await expectRevealedMarkers(4)
    })

    it('reveals only the link the cursor is in, not its adjacent neighbor', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('[a<a>](x)[b](y)'))
      fixture.set(doc)
      // Only the first link's 4 markers; the abutting second link stays hidden.
      await expectRevealedMarkers(4)
    })
  })

  describe('hide mode', () => {
    it('never reveals markers, even with the cursor inside bold', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('hide'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('Hello **<a>bold** end'))
      fixture.set(doc)
      await expectRevealedMarkers(0)
    })

    it('never reveals markers with the cursor inside a wikilink', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('hide'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('see [[no<a>te]] end'))
      fixture.set(doc)
      await expectRevealedMarkers(0)
    })

    it('strips ** from the copied text', () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('hide'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('Hello **bold** end'))
      fixture.set(doc)
      expect(clipboardText(fixture)).toBe('Hello bold end')
    })

    it('strips link [..](..) syntax from the copied text', () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('hide'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('see [docs](http://x.test)'))
      fixture.set(doc)
      expect(clipboardText(fixture)).toBe('see docs')
    })

    it('keeps a bare autolink in the copied text', () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('hide'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('visit https://example.com now'))
      fixture.set(doc)
      expect(clipboardText(fixture)).toBe('visit https://example.com now')
    })

    it('keeps the whole image source so a copied image stays markdown', () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('hide'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('see ![cat](https://example.com/cat.png) end'))
      fixture.set(doc)
      expect(clipboardText(fixture)).toBe('see ![cat](https://example.com/cat.png) end')
    })

    it('keeps the whole [[ ]] source in the copied text', () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('hide'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('see [[note]] end'))
      fixture.set(doc)
      expect(clipboardText(fixture)).toBe('see [[note]] end')
    })

    it('keeps #tag verbatim in the copied text', () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('hide'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('Hello #meow end'))
      fixture.set(doc)
      expect(clipboardText(fixture)).toBe('Hello #meow end')
    })
  })

  describe('show mode', () => {
    it('never reveals markers (syntax is always visible via CSS, not decorations)', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('show'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('Hello **<a>bold** end'))
      fixture.set(doc)
      await expectRevealedMarkers(0)
    })

    it('installs no clipboard serializer, so copied text keeps the ** syntax', () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('show'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('Hello **bold** end'))
      fixture.set(doc)
      expect(clipboardText(fixture)).toBeNull()
    })
  })

  describe('focus mode clipboard', () => {
    it('strips syntax from the copied text just like hide mode', () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('Hello **bold** end'))
      fixture.set(doc)
      expect(clipboardText(fixture)).toBe('Hello bold end')
    })
  })

  describe('md-pack structure', () => {
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
  })

  describe('focus mode backspace at a **bold** *italic* boundary', () => {
    it('captures the state after one and two backspaces', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      // Caret sits between the space after `**bold**` and the `*italic*`.
      const doc = n.doc(n.paragraph('text **bold** <a>*italic* text'))
      fixture.set(doc)
      fixture.view.focus()

      await userEvent.keyboard('{Backspace}')
      expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(
        `"text **bold▌*italic* text"`,
      )

      await userEvent.keyboard('{Backspace}')
      expect(getSelectionSnapshot(fixture.state)).toMatchInlineSnapshot(
        `"text **bol▌*italic* text"`,
      )
    })
  })
})
