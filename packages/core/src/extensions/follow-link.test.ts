import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

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
  it('follows the wikilink under the caret and passes the KeyboardEvent', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setup({ onWikilinkClick })
    fixture.set(fixture.n.doc(fixture.n.paragraph('see [[No<a>te]] here')))
    fixture.view.focus()
    await pressModEnter()
    expect(onWikilinkClick).toHaveBeenCalledWith(expect.objectContaining({ target: 'Note' }))
    expect(onWikilinkClick.mock.calls[0][0].event).toBeInstanceOf(KeyboardEvent)
    // The key was consumed: the block did not become a checkbox task.
    expect(docToMarkdown(fixture.doc)).toBe('see [[Note]] here\n')
  })

  it('follows the tag under the caret', async () => {
    const onTagClick = vi.fn<TagClickHandler>()
    using fixture = setup({ onTagClick })
    fixture.set(fixture.n.doc(fixture.n.paragraph('about #ca<a>ts today')))
    fixture.view.focus()
    await pressModEnter()
    expect(onTagClick).toHaveBeenCalledWith(expect.objectContaining({ tag: 'cats' }))
  })

  it('follows the Markdown link under the caret', async () => {
    const onLinkClick = vi.fn<LinkClickHandler>()
    using fixture = setup({ onLinkClick })
    fixture.set(fixture.n.doc(fixture.n.paragraph('see [do<a>cs](https://example.com) here')))
    fixture.view.focus()
    await pressModEnter()
    expect(onLinkClick).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'https://example.com' }),
    )
  })

  it('on a wikilink inside a task item follows instead of rotating the task', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setup({ onWikilinkClick })
    const { n } = fixture
    fixture.set(
      n.doc(n.list({ kind: 'task', checked: false }, n.paragraph('see [[No<a>te]] here'))),
    )
    fixture.view.focus()
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
    fixture.set(fixture.n.doc(fixture.n.paragraph('see [[No<a>te]] here')))
    fixture.view.focus()
    await pressModShiftEnter()
    expect(onWikilinkClick).not.toHaveBeenCalled()
    expect(docToMarkdown(fixture.doc)).toBe('+ [ ] see [[Note]] here\n')
  })

  it('falls through to the task rotation when no handler matches the unit', async () => {
    const onTagClick = vi.fn<TagClickHandler>()
    using fixture = setup({ onTagClick })
    fixture.set(fixture.n.doc(fixture.n.paragraph('see [[No<a>te]] here')))
    fixture.view.focus()
    await pressModEnter()
    expect(onTagClick).not.toHaveBeenCalled()
    expect(docToMarkdown(fixture.doc)).toBe('- [ ] see [[Note]] here\n')
  })
})
