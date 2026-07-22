import { readClipboard, writeClipboard } from '@meowdown/vitest/clipboard'
import { AllSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { markdownToDoc } from '../../converters/md-to-pm.ts'
import { docToMarkdown } from '../../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../../testing/index.ts'

/**
 * End-to-end coverage of the clipboard pipeline: real shortcut key presses,
 * the browser's native copy and paste events, and the real clipboard. The
 * table-driven behavior details stay in the synthetic-event suites next door;
 * this file keeps one representative case per flow.
 */

/** Load `markdown`, select the whole document, and press the copy shortcut. */
async function copyAll(fixture: Fixture, markdown: string): Promise<void> {
  const { editor, view } = fixture
  fixture.set(markdownToDoc(markdown, { nodes: editor.nodes }))
  view.focus()
  view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)))
  await userEvent.copy()
}

/** Press the paste shortcut in a fresh empty editor and return its markdown. */
async function pasteIntoEmptyDoc(): Promise<string> {
  using target = setupFixture()
  const { n, view } = target
  target.set(n.doc(n.paragraph()))
  view.focus()
  await userEvent.paste()
  return docToMarkdown(view.state.doc)
}

describe('native copy', () => {
  it('writes both flavors for a paragraph', async () => {
    using fixture = setupFixture()
    await copyAll(fixture, 'Hello **bold** end')
    const { html, text } = await readClipboard()
    expect(text).toBe('Hello **bold** end')
    expect(html).toContain('data-pm-slice')
    expect(html).toContain('data-md="Hello **bold** end"')
  })

  it('keeps list attributes in the clipboard HTML', async () => {
    using fixture = setupFixture()
    await copyAll(fixture, '+ [ ] Task')
    const { html, text } = await readClipboard()
    expect(text).toBe('+ [ ] Task')
    expect(html).toContain('data-list-kind="task"')
    expect(html).toContain('data-list-marker="+"')
  })

  it('strips hidden inline syntax from text/plain in hide mode', async () => {
    using fixture = setupFixture()
    const { editor, view } = fixture
    // `fixture.set` rebuilds the state, so switch the mode after loading.
    fixture.set(markdownToDoc('Hello **bold** end', { nodes: editor.nodes }))
    editor.commands.setMarkMode('hide')
    view.focus()
    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)))
    await userEvent.copy()
    const { text } = await readClipboard()
    expect(text).toBe('Hello bold end')
  })
})

describe('native copy then native paste', () => {
  it.each([
    'Hello **bold** end',
    '- one\n- **two**',
    '+ [ ] Task',
    '# title\n\ntext',
    '```rust\nfn main() {}\n```',
    '| a | b |\n| --- | --- |\n| c | d |',
  ])('round-trips %j', async (markdown) => {
    using source = setupFixture()
    await copyAll(source, markdown)
    expect(await pasteIntoEmptyDoc()).toBe(`${markdown}\n`)
  })
})

describe('native cut', () => {
  it('cuts the selection and pastes it back', async () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph('<a>gone<b>')))
    view.focus()
    await userEvent.cut()
    expect(view.state.doc.textContent).toBe('')
    view.focus()
    await userEvent.paste()
    expect(view.state.doc.textContent).toBe('gone')
  })
})

describe('native paste of external content', () => {
  it('converts rich-text HTML to markdown', async () => {
    await writeClipboard({
      'text/html': '<p>hi <strong>bold</strong> world</p>',
      'text/plain': 'hi bold world',
    })
    expect(await pasteIntoEmptyDoc()).toBe('hi **bold** world\n')
  })

  it('keeps a blank line from plain text', async () => {
    await writeClipboard({ 'text/plain': 'aaa\n\nbbb' })
    expect(await pasteIntoEmptyDoc()).toBe('aaa\n\nbbb\n')
  })

  it('takes the high fidelity path for meowdown clipboard HTML', async () => {
    await writeClipboard({
      'text/html':
        '<p data-md="x **b** y" data-meowdown="" data-pm-slice="1 1 []">x <strong>b</strong> y</p>',
      'text/plain': 'x **b** y',
    })
    expect(await pasteIntoEmptyDoc()).toBe('x **b** y\n')
  })
})
