import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { resolveWikilinkAlias, setupFixture, type Fixture } from '../testing/index.ts'
import { getTextblockDisplayText } from '../utils/display-text.ts'

import { defineWikilinkClickHandler, type WikilinkClickHandler } from './wikilink-click.ts'
import type { WikilinkResolver } from './wikilink.ts'

const pmRoot = page.locate('.ProseMirror')
const label = pmRoot.getByTestId('wikilink')

// Splits `|` like a host would, then shows only the first ` // ` segment of a
// target that has no alias.
const resolveSubject: WikilinkResolver = (link) => {
  const alias = resolveWikilinkAlias(link)
  if (alias) return alias
  const [first] = link.target.split(' // ')
  return first === link.target ? undefined : { display: first }
}

function setup(
  markdown: string,
  options: { resolveWikilink?: WikilinkResolver } = { resolveWikilink: resolveSubject },
): Fixture {
  const fixture = setupFixture({ extensionOptions: { markMode: 'hide', ...options } })
  const { n } = fixture
  fixture.set(n.doc(n.paragraph(markdown)))
  return fixture
}

describe('wikilink resolver', () => {
  it('uses the bracketed text as the label and the target without a resolver', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setup('[[Note|My Note]]', {})
    fixture.editor.use(defineWikilinkClickHandler(onWikilinkClick))
    await expect.element(label).toHaveTextContent('Note|My Note')
    await userEvent.click(label)
    expect(onWikilinkClick).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'Note|My Note' }),
    )
  })

  it('renders the resolved display as the label', async () => {
    using fixture = setup('see [[Tim MacCaw // Dad]] here')
    void fixture
    await expect.element(label).toHaveTextContent('Tim MacCaw')
  })

  it('reports the resolved target on click', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setup('[[Tim MacCaw // Dad|Dad]]')
    fixture.editor.use(defineWikilinkClickHandler(onWikilinkClick))
    await expect.element(label).toHaveTextContent('Dad')
    await userEvent.click(label)
    expect(onWikilinkClick).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'Tim MacCaw // Dad' }),
    )
  })

  it('feeds the resolved display into the display text', () => {
    using fixture = setup('see [[Tim MacCaw // Dad]] and [[Note|My Note]]')
    expect(getTextblockDisplayText(fixture.doc.child(0))).toBe('see Tim MacCaw and My Note')
  })

  it('leaves the Markdown source untouched', () => {
    using fixture = setup('see [[Tim MacCaw // Dad|Dad]] here')
    expect(fixture.doc.textContent).toBe('see [[Tim MacCaw // Dad|Dad]] here')
    expect(docToMarkdown(fixture.doc)).toBe('see [[Tim MacCaw // Dad|Dad]] here\n')
  })
})
