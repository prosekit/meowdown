import '../testing/index.ts'

import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { Editor } from './editor.tsx'
import type { EditorHandle } from './types.ts'

const pmRoot = page.locate('.ProseMirror')
const cmRoot = page.locate('.cm-editor')
const cmContent = page.locate('[data-editor="codemirror"] .cm-content')
const mdImage = page.getByTestId('md-image')

// REVIEW: rename to `createImageFile`
function imageFile(name = 'cat.png'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' })
}

// REVIEW: `@prosekit/core/test` has a `pasteFiles` API. Use that instead.
function pasteImage(target: Element, file: File): void {
  const data = new DataTransfer()
  data.items.add(file)
  target.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
  )
}

describe('Editor', () => {
  it('renders a ProseKit editor in focus mode by default', async () => {
    const screen = await render(<Editor initialMarkdown="Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'focus')
    await expect.element(cmRoot).not.toBeInTheDocument()
  })

  it('renders a CodeMirror editor in source mode', async () => {
    await render(<Editor mode="source" initialMarkdown="# Hi" />)
    await expect.element(cmRoot).toBeInTheDocument()
    await expect.element(pmRoot).not.toBeInTheDocument()
  })

  it('carries content over from a rich mode to source mode', async () => {
    const screen = await render(<Editor mode="focus" initialMarkdown="# Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()

    await screen.rerender(<Editor mode="source" initialMarkdown="# Hello" />)
    await expect.element(cmContent).toHaveTextContent('# Hello')
  })

  it('carries edits over from source mode to a rich mode', async () => {
    const screen = await render(<Editor mode="source" initialMarkdown="# Hello" />)

    await cmContent.click()
    await userEvent.keyboard('{End} World')

    await screen.rerender(<Editor mode="focus" initialMarkdown="# Hello" />)
    await expect.element(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('keeps the ProseKit editor instance when switching among rich modes', async () => {
    const screen = await render(<Editor mode="focus" />)

    await pmRoot.click()
    await userEvent.keyboard('abc')

    await screen.rerender(<Editor mode="show" />)
    await expect.element(screen.getByText('abc')).toBeInTheDocument()
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'show')
  })

  it('notifies onDocChange and exposes markdown via ref in both editors', async () => {
    const onDocChange = vi.fn()
    const ref = createRef<EditorHandle>()
    const screen = await render(
      <Editor ref={ref} mode="focus" initialMarkdown="Hello" onDocChange={onDocChange} />,
    )
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toBe('Hello\n')

    await pmRoot.click()
    await userEvent.keyboard('1')
    await vi.waitFor(() => {
      expect(onDocChange).toHaveBeenCalled()
    })
    expect(ref.current?.getMarkdown()).toContain('1')

    onDocChange.mockClear()
    await screen.rerender(
      <Editor ref={ref} mode="source" initialMarkdown="Hello" onDocChange={onDocChange} />,
    )

    await cmContent.click()
    await userEvent.keyboard('2')
    await vi.waitFor(() => {
      expect(onDocChange).toHaveBeenCalled()
    })
    expect(ref.current?.getMarkdown()).toContain('2')
  })

  it('replaces content via setMarkdown in both editors', async () => {
    const onDocChange = vi.fn()
    const ref = createRef<EditorHandle>()
    const screen = await render(
      <Editor ref={ref} initialMarkdown="Old text" onDocChange={onDocChange} />,
    )
    await expect.element(screen.getByText('Old text')).toBeInTheDocument()

    ref.current?.setMarkdown('# New title')
    await expect.element(screen.getByText('New title')).toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toBe('# New title\n')
    expect(onDocChange).toHaveBeenCalled()

    await screen.rerender(
      <Editor ref={ref} mode="source" initialMarkdown="Old text" onDocChange={onDocChange} />,
    )
    ref.current?.setMarkdown('plain')
    await expect.element(cmContent).toHaveTextContent('plain')
    expect(ref.current?.getMarkdown()).toBe('plain')
  })

  it('reports the document and selection via getState', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()

    await pmRoot.click()
    await userEvent.keyboard('{End}')
    const [markdown, selection] = ref.current?.getState() ?? ['', null]
    expect(markdown).toBe('Hello\n')
    expect(selection).toMatchObject({ type: 'text', anchor: 6, head: 6 })
  })

  it('applies markdown and a selection hint via setState', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="x" />)
    await expect.element(screen.getByText('x')).toBeInTheDocument()

    await pmRoot.click()
    ref.current?.setState('ac', { type: 'text', anchor: 2, head: 2 })
    await expect.element(screen.getByText('ac')).toBeInTheDocument()

    await userEvent.keyboard('b')
    await expect.element(screen.getByText('abc')).toBeInTheDocument()
  })

  it('moves the cursor via a selection-only setState', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="ac" />)
    await expect.element(screen.getByText('ac')).toBeInTheDocument()

    await pmRoot.click()
    ref.current?.setState(undefined, { type: 'text', anchor: 2, head: 2 })
    await userEvent.keyboard('b')
    await expect.element(screen.getByText('abc')).toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toBe('abc\n')
  })

  it('reads and writes the selection via getSelection and setSelection', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="ac" />)
    await expect.element(screen.getByText('ac')).toBeInTheDocument()

    await pmRoot.click()
    ref.current?.setSelection({ type: 'text', anchor: 2, head: 2 })
    expect(ref.current?.getSelection()).toMatchObject({ type: 'text', anchor: 2, head: 2 })

    await userEvent.keyboard('b')
    await expect.element(screen.getByText('abc')).toBeInTheDocument()
  })

  it('supports start and end selection hints', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="Hi" />)
    await expect.element(screen.getByText('Hi')).toBeInTheDocument()

    await pmRoot.click()
    ref.current?.setState(undefined, 'end')
    await userEvent.keyboard('!')
    await expect.element(screen.getByText('Hi!')).toBeInTheDocument()

    ref.current?.setState(undefined, 'start')
    await userEvent.keyboard('A')
    await expect.element(screen.getByText('AHi!')).toBeInTheDocument()
  })

  it('clamps out-of-range selection hints without throwing', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="Hi" />)
    await expect.element(screen.getByText('Hi')).toBeInTheDocument()

    await pmRoot.click()
    ref.current?.setState(undefined, { type: 'text', anchor: 9999, head: 9999 })
    await userEvent.keyboard('!')
    await expect.element(screen.getByText('Hi!')).toBeInTheDocument()

    ref.current?.setState(undefined, { type: 'text', anchor: -5, head: -5 })
    await userEvent.keyboard('A')
    await expect.element(screen.getByText('AHi!')).toBeInTheDocument()
  })

  it('round-trips the editor state through getState and setState', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="# Title" />)
    await expect.element(screen.getByText('Title')).toBeInTheDocument()

    const state = ref.current?.getState()
    ref.current?.setState(state?.[0], state?.[1])
    expect(ref.current?.getMarkdown()).toBe('# Title\n')
    expect(ref.current?.getState()).toEqual(state)
  })

  it('applies setState in source mode', async () => {
    const ref = createRef<EditorHandle>()
    await render(<Editor ref={ref} mode="source" initialMarkdown="Hello World" />)
    await expect.element(cmContent).toHaveTextContent('Hello World')

    await cmContent.click()
    ref.current?.setState('Hi', { type: 'text', anchor: 999, head: 999 })
    await expect.element(cmContent).toHaveTextContent('Hi')
    await userEvent.keyboard('!')
    await expect.element(cmContent).toHaveTextContent('Hi!')
  })

  it('focuses and scrolls via the handle in both editors', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} initialMarkdown="Hi" />)
    await expect.element(screen.getByText('Hi')).toBeInTheDocument()

    ref.current?.focus()
    ref.current?.scrollIntoView()
    await userEvent.keyboard('!')
    await expect.element(screen.getByText('!Hi')).toBeInTheDocument()

    await screen.rerender(<Editor ref={ref} mode="source" initialMarkdown="Hi" />)
    ref.current?.focus()
    ref.current?.scrollIntoView()
    await userEvent.keyboard('A')
    await expect.element(cmContent).toHaveTextContent('A!Hi')
  })
})

describe('Editor images', () => {
  it('uploads a pasted image through the public component', async () => {
    const upload = vi.fn((file: File) => `uploaded/${file.name}`)
    const ref = createRef<EditorHandle>()
    await render(<Editor ref={ref} onImageUpload={upload} />)
    await pmRoot.click()

    pasteImage(pmRoot.element(), imageFile())
    await vi.waitFor(() => {
      expect(upload).toHaveBeenCalled()
      expect(ref.current?.getMarkdown()).toContain('![](uploaded/cat.png)')
    })
  })

  it('previews a remote image with no image props and leaves paste alone', async () => {
    const ref = createRef<EditorHandle>()
    await render(<Editor ref={ref} initialMarkdown="![cat](https://example.com/cat.png)" />)
    await expect.element(mdImage).toBeInTheDocument()
    await expect
      .element(mdImage.locate('img'))
      .toHaveAttribute('src', 'https://example.com/cat.png')

    await pmRoot.click()
    pasteImage(pmRoot.element(), imageFile())
    expect(ref.current?.getMarkdown()).not.toContain('![](cat.png)')
  })

  it('accepts image props in source mode without rendering a preview', async () => {
    await render(
      <Editor
        mode="source"
        initialMarkdown="![cat](https://example.com/cat.png)"
        onImageUpload={() => 'x.png'}
      />,
    )
    await expect.element(cmContent).toHaveTextContent('![cat](https://example.com/cat.png)')
    await expect.element(mdImage).not.toBeInTheDocument()
  })

  it('calls the latest onImageUpload after a re-render', async () => {
    const first = vi.fn(() => 'first.png')
    const second = vi.fn(() => 'second.png')
    const ref = createRef<EditorHandle>()
    const screen = await render(<Editor ref={ref} onImageUpload={first} />)
    await screen.rerender(<Editor ref={ref} onImageUpload={second} />)

    await pmRoot.click()
    pasteImage(pmRoot.element(), imageFile())
    await vi.waitFor(() => {
      expect(second).toHaveBeenCalled()
      expect(ref.current?.getMarkdown()).toContain('![](second.png)')
    })
    expect(first).not.toHaveBeenCalled()
  })
})
