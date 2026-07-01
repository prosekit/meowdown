import type { EditorView } from '@prosekit/pm/view'
import { describe, expect, it, vi } from 'vitest'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import { defineImage, type ImageOptions } from './image.ts'

// An editor with the image extension configured with the given paste handlers.
function setup(options: ImageOptions, text = ''): Fixture {
  const fixture = setupFixture()
  const { editor, n } = fixture
  editor.use(defineImage({ resolveImageUrl: (src) => src, ...options }))
  fixture.set(n.doc(n.paragraph(text)))
  return fixture
}

function pdf(name: string): File {
  return new File(['%PDF'], name, { type: 'application/pdf' })
}

function png(name: string): File {
  return new File(['png'], name, { type: 'image/png' })
}

// Like `pasteFiles` from `@prosekit/core/test`, but working in every browser:
// Firefox discards the DataTransfer passed to the ClipboardEvent constructor
// (`event.clipboardData` comes back as a different, empty DataTransfer), so
// when the files did not survive, shadow the getter with the real object.
function pasteFiles(view: EditorView, files: File[]): void {
  const clipboardData = new DataTransfer()
  for (const file of files) {
    clipboardData.items.add(file)
  }
  const event = new ClipboardEvent('paste', { clipboardData })
  if (event.clipboardData?.files.length !== files.length) {
    Object.defineProperty(event, 'clipboardData', { value: clipboardData })
  }
  view.pasteHTML('<div></div>', event)
}

// Mirror of `pasteFiles` for the drop path: a synthetic `drop` event carrying
// the files, aimed at the document position `pos`. Returns the event so tests
// can assert whether the editor consumed it (`defaultPrevented`).
function dropFiles(view: EditorView, files: File[], pos: number): DragEvent {
  const dataTransfer = new DataTransfer()
  for (const file of files) {
    dataTransfer.items.add(file)
  }
  const coords = view.coordsAtPos(pos)
  const event = new DragEvent('drop', {
    dataTransfer,
    clientX: coords.left,
    clientY: (coords.top + coords.bottom) / 2,
    bubbles: true,
    cancelable: true,
  })
  view.dom.dispatchEvent(event)
  return event
}

describe('file paste', () => {
  it('inserts a [name](src) link for a pasted non-image file', async () => {
    const onFilePaste = vi.fn((file: File) => `saved://${file.name}`)
    using fixture = setup({ onFilePaste })
    pasteFiles(fixture.view, [pdf('report.pdf')])
    await vi.waitFor(() => {
      expect(fixture.doc.textContent).toBe('[report.pdf](saved://report.pdf)')
    })
    expect(onFilePaste).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ name: 'report.pdf' }),
    )
    expect(docToMarkdown(fixture.doc)).toBe('[report.pdf](saved://report.pdf)\n')
  })

  it('escapes brackets and backslashes in the filename', async () => {
    using fixture = setup({ onFilePaste: () => 'saved://f' })
    pasteFiles(fixture.view, [pdf(String.raw`re[por]t\v2.pdf`)])
    await vi.waitFor(() => {
      expect(fixture.doc.textContent).toBe(String.raw`[re\[por\]t\\v2.pdf](saved://f)`)
    })
  })

  it('inserts nothing when the callback declines with undefined', async () => {
    const onFilePaste = vi.fn(() => undefined)
    using fixture = setup({ onFilePaste }, 'text')
    pasteFiles(fixture.view, [pdf('skip.pdf')])
    await vi.waitFor(() => expect(onFilePaste).toHaveBeenCalledOnce())
    expect(fixture.doc.textContent).toBe('text')
  })

  it('pastes multiple files one link per line', async () => {
    using fixture = setup({ onFilePaste: (file) => `saved://${file.name}` })
    pasteFiles(fixture.view, [pdf('a.pdf'), pdf('b.pdf')])
    await vi.waitFor(() => {
      expect(docToMarkdown(fixture.doc)).toBe('[a.pdf](saved://a.pdf)\n[b.pdf](saved://b.pdf)\n')
    })
  })

  it('continues with the remaining files when a save throws', async () => {
    const onImageSaveError = vi.fn()
    using fixture = setup({
      onFilePaste: (file) => {
        if (file.name === 'bad.pdf') throw new Error('boom')
        return `saved://${file.name}`
      },
      onImageSaveError,
    })
    pasteFiles(fixture.view, [pdf('bad.pdf'), pdf('good.pdf')])
    await vi.waitFor(() => {
      expect(fixture.doc.textContent).toBe('[good.pdf](saved://good.pdf)')
    })
    expect(onImageSaveError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({ name: 'bad.pdf' }),
    )
  })
})

describe('file drop', () => {
  it('inserts the link at the drop position', async () => {
    using fixture = setup({ onFilePaste: (file) => `saved://${file.name}` }, 'AB')
    // Position 2 is between A and B.
    dropFiles(fixture.view, [pdf('mid.pdf')], 2)
    await vi.waitFor(() => {
      expect(fixture.doc.textContent).toBe('A[mid.pdf](saved://mid.pdf)B')
    })
  })

  it('consumes the drop when a handler can take the file', () => {
    using fixture = setup({ onFilePaste: () => 'saved://f' })
    const event = dropFiles(fixture.view, [pdf('doc.pdf')], 1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('ignores non-image files when only onImagePaste is configured', async () => {
    const onImagePaste = vi.fn(() => 'https://cdn/img.png')
    using fixture = setup({ onImagePaste }, 'text')
    const event = dropFiles(fixture.view, [pdf('doc.pdf')], 1)
    // Not consumed: the webview's default handling stays in charge.
    expect(event.defaultPrevented).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(onImagePaste).not.toHaveBeenCalled()
    expect(fixture.doc.textContent).toBe('text')
  })

  it('inserts a mixed drop one link per line, in DataTransfer order', async () => {
    using fixture = setup({
      onImagePaste: (file) => `https://cdn/${file.name}`,
      onFilePaste: (file) => `saved://${file.name}`,
    })
    dropFiles(fixture.view, [png('cat.png'), pdf('a.pdf'), png('dog.png')], 1)
    const expected = '![](https://cdn/cat.png)\n[a.pdf](saved://a.pdf)\n![](https://cdn/dog.png)'
    await vi.waitFor(() => {
      expect(fixture.doc.textContent).toBe(expected)
    })
    // The links round-trip to markdown one per line.
    expect(docToMarkdown(fixture.doc)).toBe(expected + '\n')
  })
})
