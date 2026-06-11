import '../testing/index.ts'

import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { Editor } from './editor.tsx'
import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle } from './types.ts'

const pmRoot = page.locate('.ProseMirror')
const menu = page.getByTestId('tag-menu')

const TAGS = ['art', 'book', 'food', 'movie', 'music']

function searchTags(query: string): string[] {
  return TAGS.filter((tag) => tag.includes(query))
}

describe('TagMenu', () => {
  it('opens when typing "#" followed by text and lists the matching tags', async () => {
    await render(<ProseKitEditor onTagSearch={searchTags} />)
    await pmRoot.click()
    await expect.element(menu).not.toBeVisible()
    await userEvent.keyboard('#m')
    await expect.element(menu).toBeVisible()
    await expect.element(menu.getByText('movie')).toBeVisible()
    await expect.element(menu.getByText('music')).toBeVisible()
    await expect.element(menu.getByText('book')).not.toBeInTheDocument()
  })

  it('does not open while typing a heading', async () => {
    await render(<ProseKitEditor onTagSearch={searchTags} />)
    await pmRoot.click()
    await userEvent.keyboard('# Title')
    await expect.element(menu).not.toBeVisible()
  })

  it('supports async onTagSearch and shows a loading state', async () => {
    // Deferred promise keeps the pending window deterministic (a setTimeout
    // delay could resolve before the loading assertion runs).
    let resolve!: (tags: string[]) => void
    const asyncSearch = () =>
      new Promise<string[]>((r) => {
        resolve = r
      })
    await render(<ProseKitEditor onTagSearch={asyncSearch} />)
    await pmRoot.click()
    await userEvent.keyboard('#bo')
    await expect.element(menu.getByText('Loading...')).toBeVisible()
    resolve(['book'])
    await expect.element(menu.getByText('book')).toBeVisible()
  })

  it('inserts the selected tag as text and removes the query', async () => {
    const ref = createRef<EditorHandle>()
    await render(<ProseKitEditor ref={ref} onTagSearch={searchTags} />)
    await pmRoot.click()
    await userEvent.keyboard('Hello #mo')
    await menu.getByText('movie').click()

    await expect.element(menu).not.toBeVisible()
    expect(ref.current?.getMarkdown()).toContain('Hello #movie')
    expect(ref.current?.getMarkdown()).not.toContain('#mo ')
  })

  it('renders no tag menu when onTagSearch is not given', async () => {
    await render(<ProseKitEditor />)
    await pmRoot.click()
    await userEvent.keyboard('#m')
    await expect.element(menu).not.toBeInTheDocument()
  })

  it('passes onTagSearch through <Editor>', async () => {
    await render(<Editor onTagSearch={searchTags} />)
    await pmRoot.click()
    await userEvent.keyboard('#a')
    await expect.element(menu.getByText('art')).toBeVisible()
  })
})
