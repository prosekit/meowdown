import { startBlockDrag, startTextDrag } from '@meowdown/vitest/drag-events'
import { describe, expect, it } from 'vitest'

import { markdownToDoc } from '../converters/md-to-pm.ts'
import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import { removeMovedContent } from './cross-editor-drag.ts'

function setupEditor(markdown: string, containerId: string): Fixture {
  const fixture = setupFixture({ containerId })
  fixture.set(markdownToDoc(markdown, { nodes: fixture.editor.nodes }))
  return fixture
}

function setupSource(markdown = 'Alpha\n\nBravo'): Fixture {
  return setupEditor(markdown, 'test-container')
}

// A constructed `DataTransfer` cannot carry a `dropEffect`, so these tests
// call `removeMovedContent` with the value a real `dragend` would report.
describe('removeMovedContent', () => {
  it('removes the dragged block after a move', () => {
    using source = setupSource()

    startBlockDrag(source.view, 0)
    removeMovedContent(source.view, 'move')

    expect(docToMarkdown(source.doc)).toBe('Bravo\n')
    expect(source.view.dragging).toBeNull()
  })

  it('removes a dragged text selection after a move', () => {
    using source = setupSource('Alpha Bravo')

    // "Alpha " carries no `dragging.node`, so the source delete goes through
    // `deleteSelection`.
    startTextDrag(source.view, 1, 7)
    removeMovedContent(source.view, 'move')

    expect(docToMarkdown(source.doc)).toBe('Bravo\n')
  })

  it('keeps the block after a copy', () => {
    using source = setupSource()

    startBlockDrag(source.view, 0)
    removeMovedContent(source.view, 'copy')

    expect(docToMarkdown(source.doc)).toBe('Alpha\n\nBravo\n')
  })

  it('keeps the block after a rejected or canceled drop', () => {
    using source = setupSource()

    startBlockDrag(source.view, 0)
    removeMovedContent(source.view, 'none')

    expect(docToMarkdown(source.doc)).toBe('Alpha\n\nBravo\n')
  })

  it('keeps the block when the drag event carries no data transfer', () => {
    using source = setupSource()

    startBlockDrag(source.view, 0)
    removeMovedContent(source.view, undefined)

    expect(docToMarkdown(source.doc)).toBe('Alpha\n\nBravo\n')
  })

  it('leaves an editor alone when it is not the drag source', () => {
    using source = setupSource()
    using bystander = setupEditor('Echo', 'test-container-bystander')

    startBlockDrag(source.view, 0)
    removeMovedContent(bystander.view, 'move')

    expect(docToMarkdown(bystander.doc)).toBe('Echo\n')
    expect(docToMarkdown(source.doc)).toBe('Alpha\n\nBravo\n')
  })

  it('leaves the source alone when its doc changed during the drag', () => {
    using source = setupSource()

    startBlockDrag(source.view, 0)
    // Editing the dragged block makes the dragstart-time positions stale.
    source.view.dispatch(source.view.state.tr.insertText('Zulu ', 1))
    removeMovedContent(source.view, 'move')

    expect(docToMarkdown(source.doc)).toBe('Zulu Alpha\n\nBravo\n')
  })

  it('leaves a read-only source alone', () => {
    using source = setupSource()

    source.view.setProps({ editable: () => false })
    startBlockDrag(source.view, 0)
    removeMovedContent(source.view, 'move')

    expect(docToMarkdown(source.doc)).toBe('Alpha\n\nBravo\n')
  })
})
