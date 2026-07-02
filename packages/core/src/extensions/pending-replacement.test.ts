import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture } from '../testing/index.ts'

import {
  definePendingReplacementHandler,
  getPendingReplacement,
  type PendingReplacementEvent,
} from './pending-replacement.ts'

function selectionRange(fixture: { state: { selection: { from: number; to: number } } }) {
  const { from, to } = fixture.state.selection
  return { from, to }
}

describe('pending replacement', () => {
  it('stages and accumulates text without touching the document', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('say <a>hello<b> end')))
    const before = docToMarkdown(fixture.doc)

    const { from, to } = selectionRange(fixture)
    expect(editor.commands.startPendingReplacement({ from, to, mode: 'replace' })).toBe(true)
    editor.commands.appendPendingReplacementText('good')
    editor.commands.appendPendingReplacementText('bye')

    expect(getPendingReplacement(fixture.state)).toEqual({
      from,
      to,
      mode: 'replace',
      text: 'goodbye',
    })
    expect(docToMarkdown(fixture.doc)).toBe(before)
  })

  it('discard clears the stage and leaves the document byte-identical', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('say <a>hello<b> end')))
    const before = docToMarkdown(fixture.doc)

    const { from, to } = selectionRange(fixture)
    editor.commands.startPendingReplacement({ from, to, mode: 'replace' })
    editor.commands.appendPendingReplacementText('goodbye')
    expect(editor.commands.discardPendingReplacement()).toBe(true)

    expect(getPendingReplacement(fixture.state)).toBeNull()
    expect(docToMarkdown(fixture.doc)).toBe(before)
  })

  it('accepts a single-paragraph result inline, keeping the paragraph whole', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('say <a>hello<b> end')))

    const { from, to } = selectionRange(fixture)
    editor.commands.startPendingReplacement({ from, to, mode: 'replace' })
    editor.commands.appendPendingReplacementText('goodbye **friend**')
    expect(editor.commands.acceptPendingReplacement()).toBe(true)

    expect(fixture.doc.childCount).toBe(1)
    expect(fixture.doc.child(0).textContent).toBe('say goodbye **friend** end')
    expect(getPendingReplacement(fixture.state)).toBeNull()
  })

  it('accepts a multi-block result as blocks', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>hello<b>')))

    const { from, to } = selectionRange(fixture)
    editor.commands.startPendingReplacement({ from, to, mode: 'replace' })
    editor.commands.appendPendingReplacementText('- one\n- two')
    editor.commands.acceptPendingReplacement()

    expect(docToMarkdown(fixture.doc)).toBe('- one\n- two\n')
  })

  it('accepts with a mode override (insert-below on a replace stage)', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('say <a>hello<b> end')))

    const { from, to } = selectionRange(fixture)
    editor.commands.startPendingReplacement({ from, to, mode: 'replace' })
    editor.commands.appendPendingReplacementText('a summary')
    expect(editor.commands.acceptPendingReplacement({ mode: 'append' })).toBe(true)

    expect(docToMarkdown(fixture.doc)).toBe('say hello end\n\na summary\n')
  })

  it('accepts in append mode after the source block', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>first<b>'), n.paragraph('last')))

    const { from, to } = selectionRange(fixture)
    editor.commands.startPendingReplacement({ from, to, mode: 'append' })
    editor.commands.appendPendingReplacementText('continued')
    editor.commands.acceptPendingReplacement()

    expect(docToMarkdown(fixture.doc)).toBe('first\n\ncontinued\n\nlast\n')
  })

  it('refuses to accept an empty stage', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>hello<b>')))

    const { from, to } = selectionRange(fixture)
    editor.commands.startPendingReplacement({ from, to, mode: 'replace' })
    expect(editor.commands.acceptPendingReplacement()).toBe(false)
    editor.commands.appendPendingReplacementText('   ')
    expect(editor.commands.acceptPendingReplacement()).toBe(false)
  })

  it('remaps the staged range through other edits', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('say <a>hello<b> end')))

    const { from, to } = selectionRange(fixture)
    editor.commands.startPendingReplacement({ from, to, mode: 'replace' })
    editor.commands.appendPendingReplacementText('goodbye')
    editor.commands.selectText(1)
    editor.commands.insertText({ text: 'X' })

    const pending = getPendingReplacement(fixture.state)
    expect(pending?.text).toBe('goodbye')
    expect(pending && fixture.doc.textBetween(pending.from, pending.to)).toBe('hello')

    editor.commands.acceptPendingReplacement()
    expect(fixture.doc.child(0).textContent).toBe('Xsay goodbye end')
  })

  it('discards a replace stage when its source range is deleted', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('say <a>hello<b> end')))

    const { from, to } = selectionRange(fixture)
    editor.commands.startPendingReplacement({ from, to, mode: 'replace' })
    editor.commands.appendPendingReplacementText('goodbye')
    editor.commands.insertText({ text: '!' })

    expect(getPendingReplacement(fixture.state)).toBeNull()
    expect(fixture.doc.child(0).textContent).toBe('say ! end')
  })

  it('restarting the stage resets the accumulated text (retry)', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>hello<b>')))

    const { from, to } = selectionRange(fixture)
    editor.commands.startPendingReplacement({ from, to, mode: 'replace' })
    editor.commands.appendPendingReplacementText('first attempt')
    editor.commands.startPendingReplacement({ from, to, mode: 'replace' })

    expect(getPendingReplacement(fixture.state)?.text).toBe('')
  })

  it('rejects an out-of-range or empty replace stage', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('hello')))

    expect(editor.commands.startPendingReplacement({ from: 1, to: 999, mode: 'replace' })).toBe(
      false,
    )
    expect(editor.commands.startPendingReplacement({ from: 2, to: 2, mode: 'replace' })).toBe(false)
    expect(editor.commands.startPendingReplacement({ from: 2, to: 2, mode: 'append' })).toBe(true)
  })

  it('reports updates and the outcome to a handler', () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    const events: PendingReplacementEvent[] = []
    editor.use(
      definePendingReplacementHandler((event) => {
        events.push(event)
      }),
    )
    fixture.set(n.doc(n.paragraph('<a>hello<b>')))

    const { from, to } = selectionRange(fixture)
    editor.commands.startPendingReplacement({ from, to, mode: 'replace' })
    editor.commands.appendPendingReplacementText('goodbye')
    editor.commands.acceptPendingReplacement()

    expect(events.map((event) => event.type)).toEqual(['update', 'update', 'ended'])
    const last = events.at(-1)
    expect(last?.type === 'ended' && last.outcome).toBe('accepted')

    editor.commands.startPendingReplacement({ from: 1, to: 2, mode: 'replace' })
    editor.commands.discardPendingReplacement()
    const final = events.at(-1)
    expect(final?.type === 'ended' && final.outcome).toBe('discarded')
  })

  it('Escape discards the stage', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('say <a>hello<b> end')))
    const before = docToMarkdown(fixture.doc)

    const { from, to } = selectionRange(fixture)
    editor.commands.startPendingReplacement({ from, to, mode: 'replace' })
    editor.commands.appendPendingReplacementText('goodbye')

    fixture.view.focus()
    await userEvent.keyboard('{Escape}')

    expect(getPendingReplacement(fixture.state)).toBeNull()
    expect(docToMarkdown(fixture.doc)).toBe(before)
  })
})
