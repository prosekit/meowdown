import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { findText } from '../testing/find-text.ts'
import { setupTestEnv, type TestEnv } from '../testing/index.ts'

import type { MarkMode } from './mark-mode.ts'
import { defineMarkMode } from './mark-mode.ts'

const revealedMarkers = page.locate('#test-container span.show')
const pmRoot = page.locate('.ProseMirror')

/** Asserts how many syntax markers are revealed (rendered as `.show` spans). */
async function expectRevealedMarkers(count: number): Promise<void> {
  await expect.element(revealedMarkers).toHaveLength(count)
}

/** What a full-document copy would put on the clipboard, or `null` if the mode installs no serializer. */
function clipboardText(env: TestEnv): string | null {
  const serialize = env.view.someProp('clipboardTextSerializer')
  if (!serialize) return null
  const { doc } = env
  return serialize(doc.slice(0, doc.content.size), env.view)
}

describe('defineMarkMode', () => {
  it('set data-mark-mode attribute', async () => {
    async function expectDataMarkMode(markMode: MarkMode) {
      using env = setupTestEnv()
      const { n, editor } = env
      editor.use(defineMarkMode(markMode))
      const doc = n.doc(n.paragraph('a'))
      env.set(doc)
      await expect.element(pmRoot).toHaveAttribute('data-mark-mode', markMode)
    }

    await expectDataMarkMode('focus')
    await expectDataMarkMode('hide')
    await expectDataMarkMode('show')
  })

  describe('focus mode', () => {
    it('reveals both ** when the cursor is inside **bold**', async () => {
      using env = setupTestEnv()
      env.editor.use(defineMarkMode('focus'))
      const { n } = env
      const doc = n.doc(n.paragraph('Hello **<a>bold** end'))
      env.set(doc)
      await expectRevealedMarkers(2)
    })

    it('reveals nothing when the cursor is in plain text', async () => {
      using env = setupTestEnv()
      env.editor.use(defineMarkMode('focus'))
      const { n } = env
      const doc = n.doc(n.paragraph('Hello<a> **bold** end'))
      env.set(doc)
      await expectRevealedMarkers(0)
    })

    it('reveals only the adjacent marker pair, not unrelated bolds', async () => {
      using env = setupTestEnv()
      env.editor.use(defineMarkMode('focus'))
      const { n } = env
      const doc = n.doc(n.paragraph('**<a>one** plain **two**'))
      env.set(doc)
      await expectRevealedMarkers(2)
    })

    it('reveals nested wrappers (***foo***) as 4 markers', async () => {
      using env = setupTestEnv()
      env.editor.use(defineMarkMode('focus'))
      const { n } = env
      const doc = n.doc(n.paragraph('***<a>foo***'))
      env.set(doc)
      await expectRevealedMarkers(4)
    })

    it('reveals every link marker when the cursor is in the text', async () => {
      using env = setupTestEnv()
      env.editor.use(defineMarkMode('focus'))
      const { n } = env
      const doc = n.doc(n.paragraph('see [<a>docs](http://x.test)'))
      env.set(doc)
      await expectRevealedMarkers(4)
    })

    it('reveals every link marker when the cursor is in the url', async () => {
      using env = setupTestEnv()
      env.editor.use(defineMarkMode('focus'))
      const { n } = env
      const doc = n.doc(n.paragraph('see [docs](http<a>://x.test)'))
      env.set(doc)
      await expectRevealedMarkers(4)
    })

    it('reveals when the cursor sits right after the closing **', async () => {
      using env = setupTestEnv()
      env.editor.use(defineMarkMode('focus'))
      const { n } = env
      const doc = n.doc(n.paragraph('**bold**<a> rest'))
      env.set(doc)
      await expectRevealedMarkers(2)
    })

    it('reveals nothing on a multi-char selection', async () => {
      using env = setupTestEnv()
      env.editor.use(defineMarkMode('focus'))
      const { n } = env
      const doc = n.doc(n.paragraph('**<a>bold<b>**'))
      env.set(doc)
      await expectRevealedMarkers(0)
    })

    it('reveals nothing when the cursor is inside a code block', async () => {
      using env = setupTestEnv()
      env.editor.use(defineMarkMode('focus'))
      const { n } = env
      const doc = n.doc(n.codeBlock({ language: '' }, '*not<a> italic*'))
      env.set(doc)
      await expectRevealedMarkers(0)
    })

    it('updates the reveal as the cursor moves between paragraphs', async () => {
      using env = setupTestEnv()
      env.editor.use(defineMarkMode('focus'))
      const { n } = env
      const doc = n.doc(n.paragraph('**<a>alpha** one'), n.paragraph('beta two'))
      env.set(doc)
      await expectRevealedMarkers(2)

      const twoPos = findText(env.doc, 'two')
      env.view.dispatch(env.state.tr.setSelection(TextSelection.create(env.doc, twoPos)))
      await expectRevealedMarkers(0)
    })
  })

  describe('hide mode', () => {
    it('never reveals markers, even with the cursor inside bold', async () => {
      using env = setupTestEnv()
      env.editor.use(defineMarkMode('hide'))
      const { n } = env
      const doc = n.doc(n.paragraph('Hello **<a>bold** end'))
      env.set(doc)
      await expectRevealedMarkers(0)
    })

    it('strips ** from the copied text', () => {
      using env = setupTestEnv()
      env.editor.use(defineMarkMode('hide'))
      const { n } = env
      const doc = n.doc(n.paragraph('Hello **bold** end'))
      env.set(doc)
      expect(clipboardText(env)).toBe('Hello bold end')
    })

    it('strips link [..](..) syntax from the copied text', () => {
      using env = setupTestEnv()
      env.editor.use(defineMarkMode('hide'))
      const { n } = env
      const doc = n.doc(n.paragraph('see [docs](http://x.test)'))
      env.set(doc)
      expect(clipboardText(env)).toBe('see docs')
    })
  })

  describe('show mode', () => {
    it('never reveals markers (syntax is always visible via CSS, not decorations)', async () => {
      using env = setupTestEnv()
      env.editor.use(defineMarkMode('show'))
      const { n } = env
      const doc = n.doc(n.paragraph('Hello **<a>bold** end'))
      env.set(doc)
      await expectRevealedMarkers(0)
    })

    it('installs no clipboard serializer, so copied text keeps the ** syntax', () => {
      using env = setupTestEnv()
      env.editor.use(defineMarkMode('show'))
      const { n } = env
      const doc = n.doc(n.paragraph('Hello **bold** end'))
      env.set(doc)
      expect(clipboardText(env)).toBeNull()
    })
  })

  describe('focus mode clipboard', () => {
    it('strips syntax from the copied text just like hide mode', () => {
      using env = setupTestEnv()
      env.editor.use(defineMarkMode('focus'))
      const { n } = env
      const doc = n.doc(n.paragraph('Hello **bold** end'))
      env.set(doc)
      expect(clipboardText(env)).toBe('Hello bold end')
    })
  })
})
