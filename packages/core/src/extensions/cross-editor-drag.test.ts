import { dropAt, startBlockDrag, startTextDrag } from '@meowdown/vitest/drag-events'
import { isApple } from '@prosekit/core'
import { describe, expect, it, vi } from 'vitest'

import { markdownToDoc } from '../converters/md-to-pm.ts'
import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

function setupEditor(markdown: string, containerId: string): Fixture {
  const fixture = setupFixture({ containerId })
  fixture.set(markdownToDoc(markdown, { nodes: fixture.editor.nodes }))
  return fixture
}

function setupSource(markdown = 'Alpha\n\nBravo'): Fixture {
  return setupEditor(markdown, 'test-container')
}

function setupTarget(markdown = 'Charlie'): Fixture {
  return setupEditor(markdown, 'test-container-target')
}

// Aims at the end of the last text block, where `dropPoint` inserts after it.
function endOfDoc(fixture: Fixture): number {
  return fixture.doc.content.size - 1
}

const copyModifier: DragEventInit = isApple ? { altKey: true } : { ctrlKey: true }

describe('cross editor drag', () => {
  it('removes the block from the source editor after it lands', async () => {
    using source = setupSource()
    using target = setupTarget()

    dropAt(target.view, startBlockDrag(source.view, 0), endOfDoc(target))

    await vi.waitFor(() => {
      expect(docToMarkdown(source.doc)).toBe('Bravo\n')
    })
    expect(docToMarkdown(target.doc)).toBe('Charlie\n\nAlpha\n')
  })

  it('keeps list marker fidelity while moving', async () => {
    using source = setupSource('+ [ ] Task\n\nBravo')
    using target = setupTarget()

    dropAt(target.view, startBlockDrag(source.view, 0), endOfDoc(target))

    await vi.waitFor(() => {
      expect(docToMarkdown(source.doc)).toBe('Bravo\n')
    })
    expect(docToMarkdown(target.doc)).toBe('Charlie\n\n+ [ ] Task\n')
  })

  it('moves a dragged text selection out of the source editor', async () => {
    using source = setupSource('Alpha Bravo')
    using target = setupTarget()

    // "Alpha " carries no `dragging.node`, so the source delete goes through
    // `deleteSelection`.
    dropAt(target.view, startTextDrag(source.view, 1, 7), endOfDoc(target))

    await vi.waitFor(() => {
      expect(docToMarkdown(source.doc)).toBe('Bravo\n')
    })
    expect(target.doc.textContent).toContain('Alpha')
  })

  it('copies instead of moving when the copy modifier is held', async () => {
    using source = setupSource()
    using target = setupTarget()

    dropAt(target.view, startBlockDrag(source.view, 0), endOfDoc(target), copyModifier)

    await vi.waitFor(() => {
      expect(docToMarkdown(target.doc)).toBe('Charlie\n\nAlpha\n')
    })
    expect(docToMarkdown(source.doc)).toBe('Alpha\n\nBravo\n')
  })

  it('leaves the source alone when the drop carries nothing', async () => {
    using source = setupSource()
    using target = setupTarget()

    startBlockDrag(source.view, 0)
    // An empty transfer parses to an empty slice, so nothing lands.
    dropAt(target.view, new DataTransfer(), endOfDoc(target))

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(docToMarkdown(source.doc)).toBe('Alpha\n\nBravo\n')
    expect(docToMarkdown(target.doc)).toBe('Charlie\n')
  })

  it('leaves the source alone when its doc changed during the drag', async () => {
    using source = setupSource()
    using target = setupTarget()

    const dataTransfer = startBlockDrag(source.view, 0)
    // Editing the dragged block makes the dragstart-time positions stale.
    source.view.dispatch(source.view.state.tr.insertText('Zulu ', 1))
    dropAt(target.view, dataTransfer, endOfDoc(target))

    await vi.waitFor(() => {
      expect(docToMarkdown(target.doc)).toBe('Charlie\n\nAlpha\n')
    })
    expect(docToMarkdown(source.doc)).toBe('Zulu Alpha\n\nBravo\n')
  })

  it('ignores a drop that did not start in another meowdown editor', async () => {
    using source = setupSource()
    using target = setupTarget()

    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', 'Delta')
    dropAt(target.view, dataTransfer, endOfDoc(target))

    await vi.waitFor(() => {
      expect(target.doc.textContent).toContain('Delta')
    })
    expect(docToMarkdown(source.doc)).toBe('Alpha\n\nBravo\n')
  })

  it('does not touch a third editor that is not the drag source', async () => {
    using source = setupSource()
    using target = setupTarget()
    using bystander = setupEditor('Echo', 'test-container-bystander')

    dropAt(target.view, startBlockDrag(source.view, 0), endOfDoc(target))

    await vi.waitFor(() => {
      expect(docToMarkdown(source.doc)).toBe('Bravo\n')
    })
    expect(docToMarkdown(bystander.doc)).toBe('Echo\n')
  })

  it('keeps a same editor drag on the ProseMirror move path', async () => {
    using fixture = setupSource()

    dropAt(fixture.view, startBlockDrag(fixture.view, 0), endOfDoc(fixture))

    await vi.waitFor(() => {
      expect(docToMarkdown(fixture.doc)).toBe('Bravo\n\nAlpha\n')
    })
  })
})
