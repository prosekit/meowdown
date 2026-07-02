import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { setCaret, setupFixture, type Fixture } from '../testing/index.ts'

import { defineFileView, type FileInfoResolver } from './file-view.ts'
import type { FileLinkResolver } from './inline-text-to-mark-chunks.ts'
import { defineMarkMode, type MarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')
const pill = pmRoot.getByTestId('file-pill')
const pillSize = pmRoot.getByTestId('file-pill-size')

const claimAssets: FileLinkResolver = ({ href }) => href.startsWith('assets/')

// An editor claiming `assets/` links as files, rendered as pills.
function setup(
  markdown: string,
  resolveFileInfo?: FileInfoResolver,
  mode: MarkMode = 'hide',
): Fixture {
  const fixture = setupFixture({ extensionOptions: { resolveFileLink: claimAssets } })
  const { editor, n } = fixture
  editor.use(defineFileView({ resolveFileInfo }))
  editor.use(defineMarkMode(mode))
  fixture.set(n.doc(n.paragraph(markdown)))
  return fixture
}

describe('file pill rendering', () => {
  it('renders a claimed link as a pill with its name', async () => {
    using fixture = setup('[report.pdf](assets/report.pdf)')
    await expect.element(pill).toBeInTheDocument()
    await expect.element(pill).toHaveTextContent('report.pdf')
    // The pill is a view only: the markdown text is untouched.
    expect(fixture.doc.textContent).toBe('[report.pdf](assets/report.pdf)')
  })

  it('leaves an unclaimed link as a regular link', async () => {
    using fixture = setup('[docs](https://example.com)')
    void fixture
    await expect.element(pmRoot.getByRole('link')).toBeInTheDocument()
    expect(pill.query()).toBeNull()
  })

  it('derives the file kind from the extension', async () => {
    using fixture = setup('[report.pdf](assets/report.pdf)')
    void fixture
    await expect.element(pill).toHaveAttribute('data-file-kind', 'pdf')
  })

  it('derives an archive kind case-insensitively with a query string', async () => {
    using fixture = setup('[backup](assets/backup.ZIP?v=2)')
    void fixture
    await expect.element(pill).toHaveAttribute('data-file-kind', 'archive')
  })

  it('falls back to the generic kind for an unknown extension', async () => {
    using fixture = setup('[data](assets/data.xyz)')
    void fixture
    await expect.element(pill).toHaveAttribute('data-file-kind', 'generic')
  })

  it('falls back to the generic kind without an extension', async () => {
    using fixture = setup('[data](assets/data)')
    void fixture
    await expect.element(pill).toHaveAttribute('data-file-kind', 'generic')
  })
})

describe('file pill size', () => {
  it('shows a synchronously resolved size', async () => {
    using fixture = setup('[report.pdf](assets/report.pdf)', () => ({ size: 1_400_000 }))
    void fixture
    await expect.element(pillSize).toHaveTextContent('1.4 MB')
  })

  it('fills the size in when the promise settles', async () => {
    let resolveInfo!: (info: { size: number }) => void
    const pending = new Promise<{ size: number }>((resolve) => {
      resolveInfo = resolve
    })
    using fixture = setup('[report.pdf](assets/report.pdf)', () => pending)
    void fixture
    await expect.element(pill).toBeInTheDocument()
    expect(pillSize.element().textContent).toBe('')
    resolveInfo({ size: 23_400_000 })
    await expect.element(pillSize).toHaveTextContent('23 MB')
  })

  it('leaves the size empty when the resolver returns undefined', async () => {
    using fixture = setup('[report.pdf](assets/report.pdf)', () => undefined)
    void fixture
    await expect.element(pill).toBeInTheDocument()
    expect(pillSize.element().textContent).toBe('')
  })

  it('leaves the size empty and logs when the resolver rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      using fixture = setup('[report.pdf](assets/report.pdf)', () =>
        Promise.reject(new Error('boom')),
      )
      void fixture
      await expect.element(pill).toBeInTheDocument()
      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          '[meowdown] resolveFileInfo failed:',
          expect.any(Error),
        )
      })
      expect(pillSize.element().textContent).toBe('')
    } finally {
      consoleError.mockRestore()
    }
  })

  it('ignores an invalid size', async () => {
    using fixture = setup('[report.pdf](assets/report.pdf)', () => ({ size: -1 }))
    void fixture
    await expect.element(pill).toBeInTheDocument()
    expect(pillSize.element().textContent).toBe('')
  })
})

describe('file pill update', () => {
  it('keeps the same pill element while the name is edited', async () => {
    using fixture = setup('[report.pdf](assets/report.pdf)', undefined, 'show')
    await expect.element(pill).toHaveTextContent('report.pdf')
    const pillBefore = pill.element()
    // Offset 7 = after `report`, before `.pdf` inside the label.
    setCaret(fixture, 7)
    await userEvent.keyboard('X')
    await expect.element(pill).toHaveTextContent('reportX.pdf')
    expect(pill.element()).toBe(pillBefore)
    expect(fixture.doc.textContent).toBe('[reportX.pdf](assets/report.pdf)')
  })

  it('rebuilds the pill when the href is edited', async () => {
    const resolveFileInfo = vi.fn(() => ({ size: 1000 }))
    using fixture = setup('[report.pdf](assets/report.pdf)', resolveFileInfo, 'show')
    await expect.element(pillSize).toHaveTextContent('1 KB')
    const pillBefore = pill.element()
    // Offset 26 = inside the href, right after `assets/report`.
    setCaret(fixture, 26)
    await userEvent.keyboard('X')
    await expect.element(pill).toBeInTheDocument()
    await vi.waitFor(() => {
      expect(resolveFileInfo).toHaveBeenCalledWith('assets/reportX.pdf')
    })
    expect(pill.element()).not.toBe(pillBefore)
  })

  it('drops the pill when the href is edited out of the resolver claim', async () => {
    using fixture = setup('A[report.pdf](assets/report.pdf)', undefined, 'show')
    await expect.element(pill).toBeInTheDocument()
    // Offset 14 = right after the `(`, before `assets/…`.
    setCaret(fixture, 14)
    await userEvent.keyboard('x')
    await vi.waitFor(() => {
      expect(pill.query()).toBeNull()
    })
    expect(fixture.doc.textContent).toBe('A[report.pdf](xassets/report.pdf)')
  })
})
