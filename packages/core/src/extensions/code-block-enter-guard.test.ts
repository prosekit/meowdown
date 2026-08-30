import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { setupFixture, type Fixture } from '../testing/index.ts'

const pmRoot = page.locate('.ProseMirror')
const rogueBreak = pmRoot.locate('br:not(.ProseMirror-trailingBreak)')

function setupEditor() {
  const fixture = setupFixture()
  fixture.view.focus()
  return fixture
}

// WebKit fires `compositionend` before the keydown that commits an IME
// composition, and prosemirror-view swallows the first keydown within 500ms
// after `compositionend` without `preventDefault`, letting the browser's
// native editing run. Synthetic composition events arm that swallow because
// prosemirror-view's handlers are plain event listeners, while the following
// Enter stays a real key press whose native default action is exercised.
function fakeCompositionCommit(fixture: Fixture) {
  fixture.dom.dispatchEvent(new CompositionEvent('compositionstart'))
  fixture.dom.dispatchEvent(new CompositionEvent('compositionend'))
}

describe('enter after a composition commit', () => {
  it('inserts a newline at the start of a code block', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: 'js' }, '<a>foobar')))
    fakeCompositionCommit(fixture)
    await userEvent.keyboard('{Enter}')
    await vi.waitFor(() => {
      expect(fixture.doc.eq(n.doc(n.codeBlock({ language: 'js' }, '\nfoobar')))).toBe(true)
    })
    expect(pmRoot.locate('pre').all()).toHaveLength(1)
    await expect.element(rogueBreak).not.toBeInTheDocument()
  })

  it('keeps the text before the caret in the middle of a code block', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: 'js' }, 'foo<a>bar')))
    fakeCompositionCommit(fixture)
    await userEvent.keyboard('{Enter}')
    await vi.waitFor(() => {
      expect(fixture.doc.eq(n.doc(n.codeBlock({ language: 'js' }, 'foo\nbar')))).toBe(true)
    })
    expect(pmRoot.locate('pre').all()).toHaveLength(1)
    await expect.element(rogueBreak).not.toBeInTheDocument()
  })

  it('inserts a newline on shift-enter in a code block', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: 'js' }, 'foo<a>bar')))
    // Hold Shift before the commit: a Shift press after `compositionend`
    // would itself consume prosemirror-view's one-shot swallow window.
    await userEvent.keyboard('{Shift>}')
    fakeCompositionCommit(fixture)
    await userEvent.keyboard('{Enter}{/Shift}')
    await vi.waitFor(() => {
      expect(fixture.doc.eq(n.doc(n.codeBlock({ language: 'js' }, 'foo\nbar')))).toBe(true)
    })
    await expect.element(rogueBreak).not.toBeInTheDocument()
  })

  it('splits a paragraph', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('foo<a>bar')))
    fakeCompositionCommit(fixture)
    await userEvent.keyboard('{Enter}')
    await vi.waitFor(() => {
      expect(fixture.doc.eq(n.doc(n.paragraph('foo'), n.paragraph('bar')))).toBe(true)
    })
    await expect.element(rogueBreak).not.toBeInTheDocument()
  })
})
