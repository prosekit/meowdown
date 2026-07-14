import { dropFiles, pasteFiles } from '@meowdown/vitest/file-events'
import { describe, expect, it, vi } from 'vitest'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import { buildFileMarkdown, defineFilePaste, type FilePasteOptions } from './file-paste.ts'

// An editor with the file paste extension configured with the given handlers.
function setup(options: FilePasteOptions, text = ''): Fixture {
  const fixture = setupFixture()
  const { editor, n } = fixture
  editor.use(defineFilePaste(options))
  fixture.set(n.doc(n.paragraph(text)))
  return fixture
}

function pdf(name: string): File {
  return new File(['%PDF'], name, { type: 'application/pdf' })
}

function png(name: string): File {
  return new File(['png'], name, { type: 'image/png' })
}

function fileWithoutMime(name: string): File {
  return new File(['file'], name)
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
    const onFileSaveError = vi.fn()
    using fixture = setup({
      onFilePaste: (file) => {
        if (file.name === 'bad.pdf') throw new Error('boom')
        return `saved://${file.name}`
      },
      onFileSaveError,
    })
    pasteFiles(fixture.view, [pdf('bad.pdf'), pdf('good.pdf')])
    await vi.waitFor(() => {
      expect(fixture.doc.textContent).toBe('[good.pdf](saved://good.pdf)')
    })
    expect(onFileSaveError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({ name: 'bad.pdf' }),
    )
  })

  it('inserts image syntax for a pasted image', async () => {
    const onFilePaste = vi.fn((file: File) => `saved://${file.name}`)
    using fixture = setup({ onFilePaste })
    pasteFiles(fixture.view, [png('cat.png')])
    await vi.waitFor(() => {
      expect(fixture.doc.textContent).toBe('![](saved://cat.png)')
    })
    expect(onFilePaste).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ name: 'cat.png' }),
    )
  })

  it('inserts image syntax for a pasted AVIF with no MIME type', async () => {
    using fixture = setup({ onFilePaste: (file) => `saved://${file.name}` })
    pasteFiles(fixture.view, [fileWithoutMime('photo.avif')])
    await vi.waitFor(() => {
      expect(fixture.doc.textContent).toBe('![](saved://photo.avif)')
    })
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

  it('ignores files when onFilePaste is not configured', async () => {
    using fixture = setup({}, 'text')
    const event = dropFiles(fixture.view, [pdf('doc.pdf')], 1)
    // Not consumed: the webview's default handling stays in charge.
    expect(event.defaultPrevented).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(fixture.doc.textContent).toBe('text')
  })

  it('consumes a declined drop without inserting anything', async () => {
    const onFilePaste = vi.fn(() => undefined)
    using fixture = setup({ onFilePaste }, 'text')
    const event = dropFiles(fixture.view, [png('cat.png')], 1)
    expect(event.defaultPrevented).toBe(true)
    await vi.waitFor(() => expect(onFilePaste).toHaveBeenCalledOnce())
    expect(fixture.doc.textContent).toBe('text')
  })

  it('inserts a mixed drop one link per line, in DataTransfer order', async () => {
    using fixture = setup({ onFilePaste: (file) => `saved://${file.name}` })
    dropFiles(fixture.view, [png('cat.png'), pdf('a.pdf'), png('dog.png')], 1)
    const expected = '![](saved://cat.png)\n[a.pdf](saved://a.pdf)\n![](saved://dog.png)'
    await vi.waitFor(() => {
      expect(fixture.doc.textContent).toBe(expected)
    })
    // The links round-trip to markdown one per line.
    expect(docToMarkdown(fixture.doc)).toBe(expected + '\n')
  })

  it('inserts image syntax for a dropped SVG with an incorrect MIME type', async () => {
    using fixture = setup({ onFilePaste: (file) => `saved://${file.name}` })
    const svg = new File(['<svg/>'], 'diagram.svg', { type: 'application/octet-stream' })
    dropFiles(fixture.view, [svg], 1)
    await vi.waitFor(() => {
      expect(fixture.doc.textContent).toBe('![](saved://diagram.svg)')
    })
  })
})

describe('buildFileMarkdown', () => {
  it('builds image syntax for an image type', () => {
    expect(buildFileMarkdown({ name: 'cat.png', type: 'image/png' }, 'saved://cat.png')).toBe(
      '![](saved://cat.png)',
    )
  })

  it('falls back to recognized image extensions case-insensitively', () => {
    expect(buildFileMarkdown({ name: 'photo.AVIF' }, 'assets/photo.AVIF')).toBe(
      '![](assets/photo.AVIF)',
    )
    expect(
      buildFileMarkdown(
        { name: 'diagram.svg', type: 'application/octet-stream' },
        'assets/diagram.svg',
      ),
    ).toBe('![](assets/diagram.svg)')
  })

  it('builds a link for any other file, with or without a type', () => {
    expect(buildFileMarkdown({ name: 'a.pdf', type: 'application/pdf' }, 'assets/a.pdf')).toBe(
      '[a.pdf](assets/a.pdf)',
    )
    expect(buildFileMarkdown({ name: 'a.pdf' }, 'assets/a.pdf')).toBe('[a.pdf](assets/a.pdf)')
    expect(buildFileMarkdown({ name: 'image.tiff' }, 'assets/image.tiff')).toBe(
      '[image.tiff](assets/image.tiff)',
    )
  })

  it('escapes backslashes and brackets in the name', () => {
    expect(buildFileMarkdown({ name: String.raw`a\[1].pdf` }, 'assets/a.pdf')).toBe(
      String.raw`[a\\\[1\].pdf](assets/a.pdf)`,
    )
  })
})
