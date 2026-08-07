import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import type { FileClickHandler } from './file-click.ts'
import { defineFollowLinkHandler, type FollowLinkHandlers } from './follow-link.ts'
import type { LinkClickHandler } from './link-click.ts'
import type { TagClickHandler } from './tag-click.ts'
import type { WikilinkClickHandler } from './wikilink-click.ts'

const pressModEnter = () => userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}')

function pressModShiftEnter() {
  return userEvent.keyboard('{ControlOrMeta>}{Shift>}{Enter}{/Shift}{/ControlOrMeta}')
}

function setup(handlers: FollowLinkHandlers): Fixture {
  const fixture = setupFixture()
  fixture.editor.use(defineFollowLinkHandler(handlers))
  return fixture
}

describe('defineFollowLinkHandler', () => {
  it('does not follow a wikilink pill from the caret', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setup({ onWikilinkClick })
    const { n } = fixture
    // The hidden source snaps the caret to a pill edge, and an edge is next
    // to the pill, not on it: pills follow through selection only.
    fixture.set(n.doc(n.paragraph('see [[No<a>te]] here')))
    fixture.view.focus()
    await pressModEnter()
    expect(onWikilinkClick).not.toHaveBeenCalled()
    // The key fell through to the task rotation instead.
    expect(docToMarkdown(fixture.doc)).toBe('- [ ] see [[Note]] here\n')
  })

  it('follows the tag under the caret and passes the KeyboardEvent', async () => {
    const onTagClick = vi.fn<TagClickHandler>()
    using fixture = setup({ onTagClick })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('about #ca<a>ts today')))
    fixture.view.focus()
    await pressModEnter()
    // The caret follow's modifier is its trigger, never a spare `mod`.
    expect(onTagClick).toHaveBeenCalledWith(expect.objectContaining({ tag: 'cats', mod: false }))
    expect(onTagClick.mock.calls[0][0].event).toBeInstanceOf(KeyboardEvent)
  })

  it('follows the Markdown link under the caret', async () => {
    const onLinkClick = vi.fn<LinkClickHandler>()
    using fixture = setup({ onLinkClick })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see [do<a>cs](https://example.com) here')))
    fixture.view.focus()
    await pressModEnter()
    expect(onLinkClick).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'https://example.com' }),
    )
  })

  it('follows a selected file pill instead of the link handler', async () => {
    const onFileClick = vi.fn<FileClickHandler>()
    const onLinkClick = vi.fn<LinkClickHandler>()
    using fixture = setupFixture({
      extensionOptions: { resolveFileLink: ({ href }) => href.startsWith('assets/') },
    })
    fixture.editor.use(defineFollowLinkHandler({ onFileClick, onLinkClick }))
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see [report.pdf](assets/report.pdf)<a> here')))
    fixture.view.focus()
    await userEvent.keyboard('{ArrowLeft}')
    await pressModEnter()
    expect(onFileClick).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'assets/report.pdf', name: 'report.pdf', mod: true }),
    )
    expect(onFileClick.mock.calls[0][0].event).toBeInstanceOf(KeyboardEvent)
    expect(onLinkClick).not.toHaveBeenCalled()
  })

  it('on a selected wikilink inside a task item follows instead of rotating the task', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setup({ onWikilinkClick })
    const { n } = fixture
    fixture.set(
      n.doc(n.list({ kind: 'task', checked: false }, n.paragraph('see [[Note]]<a> here'))),
    )
    fixture.view.focus()
    await userEvent.keyboard('{ArrowLeft}')
    await pressModEnter()
    expect(onWikilinkClick).toHaveBeenCalledTimes(1)
    expect(docToMarkdown(fixture.doc)).toBe('- [ ] see [[Note]] here\n')
  })

  it('off the link in the same task item rotates the task', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setup({ onWikilinkClick })
    const { n } = fixture
    fixture.set(
      n.doc(n.list({ kind: 'task', checked: false }, n.paragraph('se<a>e [[Note]] here'))),
    )
    fixture.view.focus()
    await pressModEnter()
    expect(onWikilinkClick).not.toHaveBeenCalled()
    expect(docToMarkdown(fixture.doc)).toBe('- [x] see [[Note]] here\n')
  })

  it('Mod-Shift-Enter still rotates a circle task even on a link', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setup({ onWikilinkClick })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see [[No<a>te]] here')))
    fixture.view.focus()
    await pressModShiftEnter()
    expect(onWikilinkClick).not.toHaveBeenCalled()
    expect(docToMarkdown(fixture.doc)).toBe('+ [ ] see [[Note]] here\n')
  })

  it('falls through to the task rotation when no handler matches the unit', async () => {
    const onTagClick = vi.fn<TagClickHandler>()
    using fixture = setup({ onTagClick })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see [[No<a>te]] here')))
    fixture.view.focus()
    await pressModEnter()
    expect(onTagClick).not.toHaveBeenCalled()
    expect(docToMarkdown(fixture.doc)).toBe('- [ ] see [[Note]] here\n')
  })

  it('does not follow a wikilink the caret only touches at its left edge', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setup({ onWikilinkClick })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see <a>[[Note]] here')))
    fixture.view.focus()
    await pressModEnter()
    expect(onWikilinkClick).not.toHaveBeenCalled()
    // The key fell through to the task rotation instead.
    expect(docToMarkdown(fixture.doc)).toBe('- [ ] see [[Note]] here\n')
  })

  it('does not follow a wikilink the caret only touches at its right edge', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setup({ onWikilinkClick })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see [[Note]]<a> here')))
    fixture.view.focus()
    await pressModEnter()
    expect(onWikilinkClick).not.toHaveBeenCalled()
    expect(docToMarkdown(fixture.doc)).toBe('- [ ] see [[Note]] here\n')
  })

  it('does not follow a tag the caret only touches at its edge', async () => {
    const onTagClick = vi.fn<TagClickHandler>()
    using fixture = setup({ onTagClick })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('about <a>#cats today')))
    fixture.view.focus()
    await pressModEnter()
    expect(onTagClick).not.toHaveBeenCalled()
  })

  it('Mod-Enter on a selected wikilink next to another wikilink', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setup({ onWikilinkClick })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see <a>[[Aaa]][[Bbb]] here')))
    fixture.view.focus()
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see ┃[[Aaa]][[Bbb]] here"`)

    await userEvent.keyboard('{ArrowRight}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see ❰[[Aaa]]❱[[Bbb]] here"`)

    await pressModEnter()
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see ❰[[Aaa]]❱[[Bbb]] here"`)

    expect(onWikilinkClick.mock.calls.map(([payload]) => payload.target)).toMatchInlineSnapshot(`
      [
        "Aaa",
      ]
    `)
    // On a selected unit, plain Enter is the trigger, so the modifier is spare.
    expect(onWikilinkClick.mock.calls[0][0].mod).toBe(true)
  })
  it('Enter on a selected wikilink', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setup({ onWikilinkClick })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see [[Note]]<a> here')))
    fixture.view.focus()
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see [[Note]]┃ here"`)

    await userEvent.keyboard('{ArrowLeft}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see ❰[[Note]]❱ here"`)

    await userEvent.keyboard('{Enter}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"see ❰[[Note]]❱ here"`)

    expect(onWikilinkClick.mock.calls.map(([payload]) => payload.target)).toMatchInlineSnapshot(`
      [
        "Note",
      ]
    `)
    expect(onWikilinkClick.mock.calls[0][0].mod).toBe(false)
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      see [[Note]] here

      """
    `)
  })
  it('Enter on a selected image with no matching handler is a no-op', async () => {
    using fixture = setup({})
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see ![pic](https://example.com/a.png)<a> here')))
    fixture.view.focus()

    await userEvent.keyboard('{ArrowLeft}')
    await userEvent.keyboard('{Enter}')
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      see 

       here

      """
    `)
  })

  it('Enter on a selected wikilink inside a list item does not split the item', async () => {
    using fixture = setup({})
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.paragraph('see [[Note]]<a> here'))))
    fixture.view.focus()

    await userEvent.keyboard('{ArrowLeft}')
    await userEvent.keyboard('{Enter}')
    expect(docToMarkdown(fixture.doc)).toMatchInlineSnapshot(`
      """
      - see 
      -  here

      """
    `)
  })
})
