import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'
import { getTextblockDisplayText } from '../utils/display-text.ts'

import { defineWikilinkClickHandler, type WikilinkClickHandler } from './wikilink-click.ts'
import type { WikilinkResolver } from './wikilink.ts'

const pmRoot = page.locate('.ProseMirror')
const label = pmRoot.getByTestId('wikilink')

// Shows the first ` // ` segment of a bare target and keeps an authored alias.
const showFirstSegment: WikilinkResolver = (link) => {
  if (link.display !== '') return
  const [first] = link.target.split(' // ')
  return first === link.target ? undefined : { display: first }
}

function setup(markdown: string, resolveWikilink: WikilinkResolver = showFirstSegment): Fixture {
  const fixture = setupFixture({ extensionOptions: { markMode: 'hide', resolveWikilink } })
  const { n } = fixture
  fixture.set(n.doc(n.paragraph(markdown)))
  return fixture
}

describe('wikilink resolver', () => {
  it('renders the resolved display as the label', async () => {
    using fixture = setup('see [[Tim MacCaw // Dad]] here')
    void fixture
    await expect.element(label).toHaveTextContent('Tim MacCaw')
  })

  it('keeps the default label when the resolver returns undefined', async () => {
    using fixture = setup('see [[Tim MacCaw // Dad|Dad]] and [[Note]]')
    void fixture
    await expect.element(label.first()).toHaveTextContent('Dad')
    await expect.element(label.last()).toHaveTextContent('Note')
  })

  it('receives the parsed target and alias', () => {
    const resolveWikilink = vi.fn<WikilinkResolver>(() => undefined)
    using fixture = setup('[[Tim MacCaw // Dad|Dad]]', resolveWikilink)
    void fixture
    expect(resolveWikilink).toHaveBeenCalledWith({ target: 'Tim MacCaw // Dad', display: 'Dad' })
  })

  it('reports the full target on click', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setup('[[Tim MacCaw // Dad]]')
    fixture.editor.use(defineWikilinkClickHandler(onWikilinkClick))
    await userEvent.click(label)
    expect(onWikilinkClick).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'Tim MacCaw // Dad' }),
    )
  })

  it('feeds the resolved display into the display text', () => {
    using fixture = setup('see [[Tim MacCaw // Dad]] here')
    expect(getTextblockDisplayText(fixture.doc.child(0))).toBe('see Tim MacCaw here')
  })

  it('leaves the Markdown source untouched', () => {
    using fixture = setup('see [[Tim MacCaw // Dad]] here')
    expect(fixture.doc.textContent).toBe('see [[Tim MacCaw // Dad]] here')
    expect(docToMarkdown(fixture.doc)).toBe('see [[Tim MacCaw // Dad]] here\n')
  })
})
