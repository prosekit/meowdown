import type { Uploader } from '@prosekit/extensions/file'
import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { findText } from '../testing/find-text.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import { defineImagePreview } from './image-preview.ts'
import { defineImageUpload, type ResolvedUploadOptions } from './image-upload.ts'
import { defaultResolveImageUrl } from './images.ts'

function imageFile(name = 'cat.png'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' })
}

function dataTransferWith(files: File[], text?: string): DataTransfer {
  const data = new DataTransfer()
  if (text !== undefined) data.setData('text/plain', text)
  for (const file of files) data.items.add(file)
  return data
}

function pasteFiles(fixture: Fixture, files: File[], text?: string): void {
  fixture.view.focus()
  fixture.dom.dispatchEvent(
    new ClipboardEvent('paste', {
      clipboardData: dataTransferWith(files, text),
      bubbles: true,
      cancelable: true,
    }),
  )
}

function dropFiles(fixture: Fixture, files: File[], left: number, top: number): void {
  fixture.dom.dispatchEvent(
    new DragEvent('drop', {
      dataTransfer: dataTransferWith(files),
      clientX: left,
      clientY: top,
      bubbles: true,
      cancelable: true,
    }),
  )
}

/** An uploader whose promise is resolved by hand, for deterministic timing. */
function deferredUploader(): { uploader: Uploader<string>; resolve: (url: string) => void } {
  let inner: ((url: string) => void) | null = null
  const uploader: Uploader<string> = () =>
    new Promise<string>((res) => {
      inner = res
    })
  return { uploader, resolve: (url) => inner?.(url) }
}

function setupUpload(options: Partial<ResolvedUploadOptions> = {}): Fixture {
  return setupFixture({
    extension: defineImageUpload({
      uploader: options.uploader ?? (({ file }) => Promise.resolve(`uploaded/${file.name}`)),
      canUpload: options.canUpload ?? ((file) => file.type.startsWith('image/')),
      onError: options.onError ?? (() => {}),
    }),
  })
}

function markdown(fixture: Fixture): string {
  return docToMarkdown(fixture.doc)
}

describe('image upload', () => {
  it('uploads a pasted image and swaps the placeholder for the returned src', async () => {
    const uploader = vi.fn<Uploader<string>>(({ file }) => Promise.resolve(`uploaded/${file.name}`))
    using fixture = setupUpload({ uploader })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('hi<a>')))

    const file = imageFile()
    pasteFiles(fixture, [file])
    expect(uploader).toHaveBeenCalledWith(expect.objectContaining({ file }))
    await vi.waitFor(() => {
      expect(markdown(fixture)).toBe('hi![](uploaded/cat.png)\n')
    })
  })

  it('inserts an optimistic blob placeholder before the upload resolves', async () => {
    const { uploader, resolve } = deferredUploader()
    using fixture = setupUpload({ uploader })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('hi<a>')))

    pasteFiles(fixture, [imageFile()])
    // The placeholder is inserted synchronously, carrying a blob: URL.
    expect(markdown(fixture)).toMatch(/^hi!\[]\(blob:[^)]+\)\n$/)

    resolve('final.png')
    await vi.waitFor(() => {
      expect(markdown(fixture)).toBe('hi![](final.png)\n')
    })
  })

  it('reports a rejected upload, removes the placeholder, and stays usable', async () => {
    const cause = new Error('boom')
    const onError = vi.fn()
    using fixture = setupUpload({ uploader: () => Promise.reject(cause), onError })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('hi<a>')))

    const file = imageFile()
    pasteFiles(fixture, [file])
    expect(markdown(fixture)).toContain('![](blob:')

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1)
    })
    const arg = onError.mock.calls[0][0] as { error: unknown; file: File }
    expect(arg.file).toBe(file)
    expect((arg.error as Error).cause).toBe(cause)
    expect(markdown(fixture)).toBe('hi\n')

    fixture.view.dispatch(fixture.state.tr.insertText('!', 3))
    expect(markdown(fixture)).toBe('hi!\n')
  })

  it('falls through when canUpload rejects the file', () => {
    const uploader = vi.fn<Uploader<string>>()
    using fixture = setupUpload({ uploader, canUpload: () => false })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('hi<a>')))

    pasteFiles(fixture, [imageFile()])
    expect(uploader).not.toHaveBeenCalled()
    expect(markdown(fixture)).not.toContain('![]')
  })

  it('ignores a non-image file with the default canUpload', () => {
    const uploader = vi.fn<Uploader<string>>()
    using fixture = setupUpload({ uploader })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('hi<a>')))

    const textFile = new File(['x'], 'notes.txt', { type: 'text/plain' })
    pasteFiles(fixture, [textFile])
    expect(uploader).not.toHaveBeenCalled()
    expect(markdown(fixture)).not.toContain('![]')
  })

  it('falls through for a text-only clipboard, leaving paste to the default', async () => {
    const uploader = vi.fn<Uploader<string>>()
    using fixture = setupUpload({ uploader })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))

    pasteFiles(fixture, [], 'plain text')
    await expect.element(page.getByText('plain text')).toBeInTheDocument()
    expect(uploader).not.toHaveBeenCalled()
    expect(markdown(fixture)).not.toContain('![]')
  })

  it('does nothing on an image paste when no upload handler is installed', async () => {
    using fixture = setupFixture()
    fixture.editor.use(defineImagePreview(defaultResolveImageUrl))
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('hi<a>')))

    pasteFiles(fixture, [imageFile()])
    await vi.waitFor(() => {
      expect(markdown(fixture)).toBe('hi\n')
    })
  })

  it('consumes a clipboard carrying both an image and text (D7)', async () => {
    using fixture = setupUpload()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))

    pasteFiles(fixture, [imageFile()], 'pasted html text')
    await vi.waitFor(() => {
      expect(markdown(fixture)).toBe('![](uploaded/cat.png)\n')
    })
    expect(markdown(fixture)).not.toContain('pasted html text')
  })

  it('uploads two pasted files and inserts them in order', async () => {
    using fixture = setupUpload()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))

    pasteFiles(fixture, [imageFile('a.png'), imageFile('b.png')])
    await vi.waitFor(() => {
      expect(markdown(fixture)).toBe('![](uploaded/a.png)![](uploaded/b.png)\n')
    })
  })

  it('drops an image at the drop point, not the caret', async () => {
    using fixture = setupUpload({ uploader: () => Promise.resolve('drop.png') })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('first<a>'), n.paragraph('second')))

    const target = findText(fixture.doc, 'second') + 3
    const coords = fixture.view.coordsAtPos(target)
    dropFiles(fixture, [imageFile()], coords.left, coords.top)
    await vi.waitFor(() => {
      expect(markdown(fixture)).toContain('![](drop.png)')
    })
    expect(markdown(fixture)).toMatch(/^first\n\n/)
  })

  it('swaps the placeholder wherever concurrent edits push it', async () => {
    const { uploader, resolve } = deferredUploader()
    using fixture = setupUpload({ uploader })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('hello<a>')))

    pasteFiles(fixture, [imageFile()])
    // Edit the document start while the upload is in flight.
    fixture.view.dispatch(fixture.state.tr.insertText('XYZ', 1))
    resolve('flight.png')

    await vi.waitFor(() => {
      expect(markdown(fixture)).toBe('XYZhello![](flight.png)\n')
    })
  })

  it('swaps every copy of an in-flight placeholder', async () => {
    const { uploader, resolve } = deferredUploader()
    using fixture = setupUpload({ uploader })
    const { n } = fixture
    // The marker must not collide with the blob: URL that findText scans.
    fixture.set(n.doc(n.paragraph('one<a>'), n.paragraph('ZZZ')))

    pasteFiles(fixture, [imageFile()])
    const blob = markdown(fixture).match(/!\[]\((blob:[^)]+)\)/)?.[1]
    expect(blob).toBeTruthy()
    // Duplicate the placeholder into the second paragraph.
    fixture.view.dispatch(fixture.state.tr.insertText(`![](${blob})`, findText(fixture.doc, 'ZZZ')))
    resolve('dup.png')

    await vi.waitFor(() => {
      const md = markdown(fixture)
      expect(md).not.toContain('blob:')
      expect(md.match(/!\[]\(dup\.png\)/g) ?? []).toHaveLength(2)
    })
  })

  it('drops the swap when the placeholder block is deleted in flight', async () => {
    const { uploader, resolve } = deferredUploader()
    using fixture = setupUpload({ uploader })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('keep'), n.paragraph('gone<a>')))

    pasteFiles(fixture, [imageFile()])
    // Delete the whole second paragraph (where the placeholder lives).
    fixture.view.dispatch(fixture.state.tr.delete(6, fixture.doc.content.size))
    resolve('gone.png')

    await vi.waitFor(() => {
      expect(markdown(fixture)).toBe('keep\n')
    })
    expect(markdown(fixture)).not.toContain('![]')
  })

  it('does not dispatch after the editor is unmounted', async () => {
    const { uploader, resolve } = deferredUploader()
    const fixture = setupUpload({ uploader })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('hi<a>')))

    pasteFiles(fixture, [imageFile()])
    const view = fixture.view
    fixture.editor.unmount()
    expect(view.isDestroyed).toBe(true)

    // Resolving after unmount must not dispatch or throw.
    resolve('late.png')
    await Promise.resolve()
    await Promise.resolve()
    expect(view.isDestroyed).toBe(true)
  })
})
