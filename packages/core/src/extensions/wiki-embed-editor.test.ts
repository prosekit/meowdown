import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { updateEditorConfig } from '../testing/editor-config.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import type { FileClickHandler } from './file-click.ts'
import type { ImageClickHandler } from './image-click.ts'
import type { ImageOptions } from './image.ts'
import type { WikiEmbedResolution } from './wiki-embed.ts'
import type { WikilinkClickHandler } from './wikilink-click.ts'

const pmRoot = page.locate('.ProseMirror')

function setup(markdown: string, resolution: WikiEmbedResolution | undefined): Fixture {
  const fixture = setupFixture({
    extensionOptions: {
      markMode: 'hide',
      resolveWikiEmbed: () => resolution,
    },
  })
  const { n } = fixture
  fixture.set(n.doc(n.paragraph(markdown)))
  return fixture
}

describe('wiki embed editor integration', () => {
  it('keeps unresolved embeds literal and editable', async () => {
    using fixture = setup('before ![[missing.png]] after', undefined)
    expect(fixture.dom.querySelector('.md-atom-view')).toBeNull()
    await expect.element(pmRoot).toHaveTextContent('before ![[missing.png]] after')
  })

  it('uses image rendering and image click hooks', async () => {
    const onImageClick = vi.fn<ImageClickHandler>()
    using fixture = setup('![[photo.png|Photo]]', { kind: 'image' })
    const imageOptions: ImageOptions = { resolveImageUrl: () => 'https://example.com/photo.png' }
    updateEditorConfig(fixture.editor, imageOptions, true)
    updateEditorConfig(fixture.editor, { onImageClick })

    const image = pmRoot.getByAltText('Photo')
    await expect.element(image).toBeInTheDocument()
    await userEvent.click(image)
    expect(onImageClick).toHaveBeenCalledWith(
      expect.objectContaining({ src: 'photo.png', alt: 'Photo' }),
    )
  })

  it('uses file pills and file click hooks', async () => {
    const onFileClick = vi.fn<FileClickHandler>()
    using fixture = setup('![[docs/report.pdf|Quarterly]]', { kind: 'file' })
    updateEditorConfig(fixture.editor, { onFileClick })

    const pill = pmRoot.getByTestId('file-pill')
    await expect.element(pill).toHaveTextContent('Quarterly')
    await userEvent.click(pill)
    expect(onFileClick).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'docs/report.pdf', name: 'Quarterly' }),
    )
  })

  it('uses wikilink chips and wikilink click hooks for note fallbacks', async () => {
    const onWikilinkClick = vi.fn<WikilinkClickHandler>()
    using fixture = setup('![[Projects/Plan|Launch plan]]', { kind: 'note' })
    updateEditorConfig(fixture.editor, { onWikilinkClick })

    const chip = pmRoot.getByTestId('wikilink')
    await expect.element(chip).toHaveTextContent('Launch plan')
    await userEvent.click(chip)
    expect(onWikilinkClick).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'Projects/Plan' }),
    )
  })
})
