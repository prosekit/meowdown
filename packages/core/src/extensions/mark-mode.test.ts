import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'

import { findText } from '../testing/find-text.ts'
import { setupTestEnv, type TestEnv } from '../testing/index.ts'

import type { MarkMode } from './mark-mode-plugin.ts'

/** Number of syntax markers currently revealed (rendered as `.show` spans). */
function countRevealedMarkers(env: TestEnv): number {
  return env.dom.querySelectorAll('span.show').length
}

/** What a full-document copy would put on the clipboard, or `null` if the mode installs no serializer. */
function clipboardText(env: TestEnv): string | null {
  const serialize = env.view.someProp('clipboardTextSerializer')
  if (!serialize) return null
  const { doc } = env
  return serialize(doc.slice(0, doc.content.size), env.view)
}

describe('defineMarkModePlugin', () => {
  it('set data-mark-mode attribute', () => {
    function getDataMarkMode(markMode?: MarkMode) {
      using env = setupTestEnv({ markMode })
      const { n } = env
      const doc = n.doc(n.paragraph('a'))
      env.set(doc)
      return env.dom.getAttribute('data-mark-mode')
    }

    expect(getDataMarkMode('focus')).toBe('focus')
    expect(getDataMarkMode('hide')).toBe('hide')
    expect(getDataMarkMode('show')).toBe('show')
    // defaults to focus
    expect(getDataMarkMode()).toBe('focus')
  })

  describe('focus mode', () => {
    it('reveals both ** when the cursor is inside **bold**', () => {
      using env = setupTestEnv({ markMode: 'focus' })
      const { n } = env
      const doc = n.doc(n.paragraph('Hello **<a>bold** end'))
      env.set(doc)
      expect(countRevealedMarkers(env)).toBe(2)
    })

    it('reveals nothing when the cursor is in plain text', () => {
      using env = setupTestEnv({ markMode: 'focus' })
      const { n } = env
      const doc = n.doc(n.paragraph('Hello<a> **bold** end'))
      env.set(doc)
      expect(countRevealedMarkers(env)).toBe(0)
    })

    it('reveals only the adjacent marker pair, not unrelated bolds', () => {
      using env = setupTestEnv({ markMode: 'focus' })
      const { n } = env
      const doc = n.doc(n.paragraph('**<a>one** plain **two**'))
      env.set(doc)
      expect(countRevealedMarkers(env)).toBe(2)
    })

    it('reveals nested wrappers (***foo***) as 4 markers', () => {
      using env = setupTestEnv({ markMode: 'focus' })
      const { n } = env
      const doc = n.doc(n.paragraph('***<a>foo***'))
      env.set(doc)
      expect(countRevealedMarkers(env)).toBe(4)
    })

    it('reveals every link marker when the cursor is in the text', () => {
      using env = setupTestEnv({ markMode: 'focus' })
      const { n } = env
      const doc = n.doc(n.paragraph('see [<a>docs](http://x.test)'))
      env.set(doc)
      expect(countRevealedMarkers(env)).toBe(4)
    })

    it('reveals every link marker when the cursor is in the url', () => {
      using env = setupTestEnv({ markMode: 'focus' })
      const { n } = env
      const doc = n.doc(n.paragraph('see [docs](http<a>://x.test)'))
      env.set(doc)
      expect(countRevealedMarkers(env)).toBe(4)
    })

    it('reveals when the cursor sits right after the closing **', () => {
      using env = setupTestEnv({ markMode: 'focus' })
      const { n } = env
      const doc = n.doc(n.paragraph('**bold**<a> rest'))
      env.set(doc)
      expect(countRevealedMarkers(env)).toBe(2)
    })

    it('reveals nothing on a multi-char selection', () => {
      using env = setupTestEnv({ markMode: 'focus' })
      const { n } = env
      const doc = n.doc(n.paragraph('**<a>bold<b>**'))
      env.set(doc)
      expect(countRevealedMarkers(env)).toBe(0)
    })

    it('reveals nothing when the cursor is inside a code block', () => {
      using env = setupTestEnv({ markMode: 'focus' })
      const { n } = env
      const doc = n.doc(n.codeBlock({ language: '' }, '*not<a> italic*'))
      env.set(doc)
      expect(countRevealedMarkers(env)).toBe(0)
    })

    it('updates the reveal as the cursor moves between paragraphs', () => {
      using env = setupTestEnv({ markMode: 'focus' })
      const { n } = env
      const doc = n.doc(n.paragraph('**<a>alpha** one'), n.paragraph('beta two'))
      env.set(doc)
      expect(countRevealedMarkers(env)).toBe(2)

      const twoPos = findText(env.doc, 'two')
      env.view.dispatch(env.state.tr.setSelection(TextSelection.create(env.doc, twoPos)))
      expect(countRevealedMarkers(env)).toBe(0)
    })
  })

  describe('hide mode', () => {
    it('never reveals markers, even with the cursor inside bold', () => {
      using env = setupTestEnv({ markMode: 'hide' })
      const { n } = env
      const doc = n.doc(n.paragraph('Hello **<a>bold** end'))
      env.set(doc)
      expect(countRevealedMarkers(env)).toBe(0)
    })

    it('strips ** from the copied text', () => {
      using env = setupTestEnv({ markMode: 'hide' })
      const { n } = env
      const doc = n.doc(n.paragraph('Hello **bold** end'))
      env.set(doc)
      expect(clipboardText(env)).toBe('Hello bold end')
    })

    it('strips link [..](..) syntax from the copied text', () => {
      using env = setupTestEnv({ markMode: 'hide' })
      const { n } = env
      const doc = n.doc(n.paragraph('see [docs](http://x.test)'))
      env.set(doc)
      expect(clipboardText(env)).toBe('see docs')
    })
  })

  describe('show mode', () => {
    it('never reveals markers (syntax is always visible via CSS, not decorations)', () => {
      using env = setupTestEnv({ markMode: 'show' })
      const { n } = env
      const doc = n.doc(n.paragraph('Hello **<a>bold** end'))
      env.set(doc)
      expect(countRevealedMarkers(env)).toBe(0)
    })

    it('installs no clipboard serializer, so copied text keeps the ** syntax', () => {
      using env = setupTestEnv({ markMode: 'show' })
      const { n } = env
      const doc = n.doc(n.paragraph('Hello **bold** end'))
      env.set(doc)
      expect(clipboardText(env)).toBeNull()
    })
  })

  describe('focus mode clipboard', () => {
    it('strips syntax from the copied text just like hide mode', () => {
      using env = setupTestEnv({ markMode: 'focus' })
      const { n } = env
      const doc = n.doc(n.paragraph('Hello **bold** end'))
      env.set(doc)
      expect(clipboardText(env)).toBe('Hello bold end')
    })
  })
})
