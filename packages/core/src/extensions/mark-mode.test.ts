import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { findText } from '../testing/find-text.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import type { MarkMode } from './mark-mode.ts'
import { defineMarkMode } from './mark-mode.ts'

const revealedMarkers = page.locate('.ProseMirror span.show')
const pmRoot = page.locate('.ProseMirror')

/** Asserts how many syntax markers are revealed (rendered as `.show` spans). */
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

    it('reveals both [[ ]] when the cursor is inside a wikilink', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('see [[no<a>te]] end'))
      fixture.set(doc)
      await expectRevealedMarkers(3)
    })

    it('reveals only the wikilink brackets next to a markdown link', async () => {
      using fixture = setupFixture()
      fixture.editor.use(defineMarkMode('focus'))
      const { n } = fixture
      const doc = n.doc(n.paragraph('[a](http://x)[[no<a>te]]'))
      fixture.set(doc)
      await expectRevealedMarkers(3)
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
})
