import { describe, expect, it } from 'vitest'

import { markdownToDoc } from '../converters/md-to-pm.ts'
import { setupFixture } from '../testing/index.ts'

import { getPresentedLinks, setLinkPresentation } from './link-presentation.ts'

const TWEET = 'https://x.com/jack/status/20'
const VIDEO = 'https://youtu.be/aqz-KE-bpKQ'

function setup(markdown: string) {
  const fixture = setupFixture({
    extensionOptions: { resolveXPost: () => undefined, resolveYouTubeVideo: () => undefined },
  })
  fixture.editor.setContent(markdownToDoc(markdown, { nodes: fixture.editor.nodes }))
  fixture.editor.commands.selectAll()
  return fixture
}

describe('link presentation', () => {
  it('preserves parsed titles and escaped labels through both conversions', () => {
    using fixture = setup(`[a \\[b\\] \\*c\\*](${VIDEO} 'Demo "title"')`)
    const { editor, view } = fixture
    expect(setLinkPresentation('embed')(editor.state, view.dispatch, view)).toBe(true)
    expect(getPresentedLinks(editor.state)[0]?.title).toBe('Demo "title"')
    expect(editor.state.doc.textContent).toContain('![a \\[b\\] \\*c\\*]')
    expect(setLinkPresentation('link')(editor.state, view.dispatch, view)).toBe(true)
    expect(getPresentedLinks(editor.state)[0]?.title).toBe('Demo "title"')
    expect(editor.state.doc.textContent).toContain('[a \\[b\\] \\*c\\*]')
    expect(editor.state.doc.textContent).not.toContain('\\\\[')
  })

  it('keeps a collapsed caret collapsed inside a converted link', () => {
    using fixture = setup(VIDEO)
    const { editor, view } = fixture
    editor.commands.selectText(8)
    expect(setLinkPresentation('embed')(editor.state, view.dispatch, view)).toBe(true)
    expect(editor.state.selection.empty).toBe(true)
    expect(editor.state.selection.from).toBeGreaterThan(8)
  })

  it('recovers a failed embed as an ordinary link, with undo', () => {
    using fixture = setup(`![](${TWEET})`)
    const { editor, view } = fixture
    expect(getPresentedLinks(editor.state).map((link) => link.presentation)).toEqual(['embed'])
    expect(setLinkPresentation('link')(editor.state, view.dispatch, view)).toBe(true)
    expect(editor.state.doc.textContent).toBe(`[${TWEET}](${TWEET})`)
    expect(getPresentedLinks(editor.state).map((link) => link.presentation)).toEqual(['link'])
    editor.commands.undo()
    expect(editor.state.doc.textContent).toBe(`![](${TWEET})`)
  })

  it('converts selected supported links only, preserving surrounding text and code', () => {
    using fixture = setup(
      `Before ${TWEET} and [video](${VIDEO}) after.\n\n\`${TWEET}\`\n\n\`\`\`\n${TWEET}\n\`\`\`\n\nhttps://example.com`,
    )
    const { editor, view } = fixture
    expect(getPresentedLinks(editor.state)).toHaveLength(2)
    expect(setLinkPresentation('embed')(editor.state, view.dispatch, view)).toBe(true)
    expect(editor.state.doc.textContent).toContain(
      `Before ![${TWEET}](${TWEET}) and ![video](${VIDEO}) after.`,
    )
    expect(editor.state.doc.textContent).toContain(`\`${TWEET}\``)
    expect(editor.state.doc.textContent).toContain('https://example.com')
    expect(getPresentedLinks(editor.state)).toHaveLength(2)
    expect(setLinkPresentation('link')(editor.state, view.dispatch, view)).toBe(true)
    expect(editor.state.doc.textContent).toContain(`[video](${VIDEO})`)
  })

  it('leaves unrelated selected links untouched', () => {
    using fixture = setup('[example](https://example.com)')
    expect(setLinkPresentation('embed')(fixture.editor.state)).toBe(false)
  })
})
