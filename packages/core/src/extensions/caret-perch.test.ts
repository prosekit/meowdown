import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { findText } from '../testing/find-text.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import type { MarkMode } from './mark-mode.ts'

const SOURCE = '[[Cat care basics]]'

// A bullet whose only content is one wikilink: the layout that oscillates on
// iOS when the DOM anchor sinks into the hidden atom source.
function setup(mode: MarkMode): Fixture {
  const fixture = setupFixture({ extensionOptions: { markMode: mode } })
  const { n } = fixture
  fixture.set(
    n.doc(n.list({ kind: 'bullet' }, n.paragraph(SOURCE)), n.paragraph('plain trailing paragraph')),
  )
  fixture.view.focus()
  return fixture
}

function dropCaret(fixture: Fixture, pos: number): void {
  fixture.view.dispatch(fixture.state.tr.setSelection(TextSelection.create(fixture.doc, pos)))
}

// The element the DOM selection anchor effectively rests in.
function anchorElement(): Element | null {
  const anchor = document.getSelection()?.anchorNode
  if (anchor == null) return null
  return anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as Element)
}

// The iOS-stability guard: iOS relocates anchors that have no caret geometry
// (hidden atom source text), so a visible anchor is the condition that keeps
// it from moving. This is checkable on desktop; the loop itself is not.
function expectHealthyAnchor(): void {
  const el = anchorElement()
  expect(el).not.toBeNull()
  expect(el!.closest('.md-atom-view-content')).toBeNull()
  expect(getComputedStyle(el!).fontSize).not.toBe('0px')
}

const ALL_MODES: MarkMode[] = ['hide', 'focus', 'show']

describe.each(ALL_MODES)('caret perch in %s mode', (mode) => {
  it('anchors the caret before the atom on visible geometry', () => {
    using fixture = setup(mode)
    dropCaret(fixture, findText(fixture.doc, SOURCE))
    const perch = fixture.dom.querySelector('.md-caret-perch')
    expect(perch).not.toBeNull()
    expect(perch!.parentElement?.nodeName).toBe('P')
    expectHealthyAnchor()
  })

  it('anchors the caret after the atom on visible geometry', () => {
    using fixture = setup(mode)
    dropCaret(fixture, findText(fixture.doc, SOURCE) + SOURCE.length)
    const perch = fixture.dom.querySelector('.md-caret-perch')
    expect(perch).not.toBeNull()
    expect(perch!.parentElement?.nodeName).toBe('P')
    expectHealthyAnchor()
  })

  it('mounts no perch beside plain text', () => {
    using fixture = setup(mode)
    dropCaret(fixture, findText(fixture.doc, 'plain trailing') + 2)
    expect(fixture.dom.querySelector('.md-caret-perch')).toBeNull()
  })
})

describe('caret perch editing', () => {
  it('typing at the atom boundaries lands beside the source, without ZWSP', async () => {
    using fixture = setup('hide')
    const start = findText(fixture.doc, SOURCE)
    dropCaret(fixture, start + SOURCE.length)
    await userEvent.keyboard('B')
    dropCaret(fixture, findText(fixture.doc, SOURCE))
    await userEvent.keyboard('A')
    expect(fixture.doc.textContent).toContain(`A${SOURCE}B`)
    expect(fixture.doc.textContent).not.toContain('\u{200B}')
  })

  it('Backspace after the atom still deletes it as a unit', async () => {
    using fixture = setup('hide')
    dropCaret(fixture, findText(fixture.doc, SOURCE) + SOURCE.length)
    await userEvent.keyboard('{Backspace}')
    expect(fixture.doc.textContent).not.toContain('Cat care')
  })
})
