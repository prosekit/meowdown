import '../testing/index.ts'

import { pasteText } from '@prosekit/core/test'
import { TextSelection } from '@prosekit/pm/state'
import { useEditor } from '@prosekit/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import { MeowdownEditor } from './editor.tsx'
import type { EditorHandle } from './types.ts'

const pmRoot = page.locate('.ProseMirror')
const cmRoot = page.locate('.cm-editor')
const cmContent = page.locate('[data-editor="codemirror"] .cm-content')

// Renders only when it sits inside the editor's ProseKit context; `useEditor`
// throws otherwise.
function EditorProbe() {
  const editor = useEditor()
  return <span data-testid="probe">{editor ? 'has-editor' : 'no-editor'}</span>
}

describe('MeowdownEditor', () => {
  it('renders a ProseKit editor in focus mode by default', async () => {
    const screen = await render(<MeowdownEditor initialMarkdown="Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'focus')
    await expect.element(cmRoot).not.toBeInTheDocument()
  })

  it('renders a CodeMirror editor in source mode', async () => {
    await render(<MeowdownEditor mode="source" initialMarkdown="# Hi" />)
    await expect.element(cmRoot).toBeInTheDocument()
    await expect.element(pmRoot).not.toBeInTheDocument()
  })

  it('carries content over from a rich mode to source mode', async () => {
    const screen = await render(<MeowdownEditor mode="focus" initialMarkdown="# Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()

    await screen.rerender(<MeowdownEditor mode="source" initialMarkdown="# Hello" />)
    await expect.element(cmContent).toHaveTextContent('# Hello')
  })

  it('carries edits over from source mode to a rich mode', async () => {
    const screen = await render(<MeowdownEditor mode="source" initialMarkdown="# Hello" />)

    await cmContent.click()
    await userEvent.keyboard('{End} World')

    await screen.rerender(<MeowdownEditor mode="focus" initialMarkdown="# Hello" />)
    await expect.element(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('keeps the ProseKit editor instance when switching among rich modes', async () => {
    const screen = await render(<MeowdownEditor mode="focus" />)

    await pmRoot.click()
    await userEvent.keyboard('abc')

    await screen.rerender(<MeowdownEditor mode="show" />)
    await expect.element(screen.getByText('abc')).toBeInTheDocument()
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'show')
  })

  it('notifies onDocChange and exposes markdown via ref in both editors', async () => {
    const onDocChange = vi.fn()
    const ref = createRef<EditorHandle>()
    const screen = await render(
      <MeowdownEditor
        handleRef={ref}
        mode="focus"
        initialMarkdown="Hello"
        onDocChange={onDocChange}
      />,
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
      <MeowdownEditor
        handleRef={ref}
        mode="source"
        initialMarkdown="Hello"
        onDocChange={onDocChange}
      />,
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
      <MeowdownEditor handleRef={ref} initialMarkdown="Old text" onDocChange={onDocChange} />,
    )
    await expect.element(screen.getByText('Old text')).toBeInTheDocument()

    ref.current?.setMarkdown('# New title')
    await expect.element(screen.getByText('New title')).toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toBe('# New title\n')
    // Programmatic setMarkdown is silent: the host that called it already knows.
    expect(onDocChange).not.toHaveBeenCalled()

    await screen.rerender(
      <MeowdownEditor
        handleRef={ref}
        mode="source"
        initialMarkdown="Old text"
        onDocChange={onDocChange}
      />,
    )
    ref.current?.setMarkdown('plain')
    await expect.element(cmContent).toHaveTextContent('plain')
    expect(ref.current?.getMarkdown()).toBe('plain')
    expect(onDocChange).not.toHaveBeenCalled()
  })

  it('reports the document and selection via getState', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<MeowdownEditor handleRef={ref} initialMarkdown="Hello" />)
    await expect.element(screen.getByText('Hello')).toBeInTheDocument()

    await pmRoot.click()
    await userEvent.keyboard('{End}')
    const [markdown, selection] = ref.current?.getState() ?? ['', null]
    expect(markdown).toBe('Hello\n')
    expect(selection).toMatchObject({ type: 'text', anchor: 6, head: 6 })
  })

  it('applies markdown and a selection hint via setState', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<MeowdownEditor handleRef={ref} initialMarkdown="x" />)
    await expect.element(screen.getByText('x')).toBeInTheDocument()

    await pmRoot.click()
    ref.current?.setState('ac', { type: 'text', anchor: 2, head: 2 })
    await expect.element(screen.getByText('ac')).toBeInTheDocument()

    await userEvent.keyboard('b')
    await expect.element(screen.getByText('abc')).toBeInTheDocument()
  })

  it('moves the cursor via a selection-only setState', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<MeowdownEditor handleRef={ref} initialMarkdown="ac" />)
    await expect.element(screen.getByText('ac')).toBeInTheDocument()

    await pmRoot.click()
    ref.current?.setState(undefined, { type: 'text', anchor: 2, head: 2 })
    await userEvent.keyboard('b')
    await expect.element(screen.getByText('abc')).toBeInTheDocument()
    expect(ref.current?.getMarkdown()).toBe('abc\n')
  })

  it('reads and writes the selection via getSelection and setSelection', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<MeowdownEditor handleRef={ref} initialMarkdown="ac" />)
    await expect.element(screen.getByText('ac')).toBeInTheDocument()

    await pmRoot.click()
    ref.current?.setSelection({ type: 'text', anchor: 2, head: 2 })
    expect(ref.current?.getSelection()).toMatchObject({ type: 'text', anchor: 2, head: 2 })

    await userEvent.keyboard('b')
    await expect.element(screen.getByText('abc')).toBeInTheDocument()
  })

  it('supports start and end selection hints', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<MeowdownEditor handleRef={ref} initialMarkdown="Hi" />)
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
    const screen = await render(<MeowdownEditor handleRef={ref} initialMarkdown="Hi" />)
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
    const screen = await render(<MeowdownEditor handleRef={ref} initialMarkdown="# Title" />)
    await expect.element(screen.getByText('Title')).toBeInTheDocument()

    const state = ref.current?.getState()
    ref.current?.setState(state?.[0], state?.[1])
    expect(ref.current?.getMarkdown()).toBe('# Title\n')
    expect(ref.current?.getState()).toEqual(state)
  })

  it('applies setState in source mode', async () => {
    const ref = createRef<EditorHandle>()
    await render(<MeowdownEditor handleRef={ref} mode="source" initialMarkdown="Hello World" />)
    await expect.element(cmContent).toHaveTextContent('Hello World')

    await cmContent.click()
    ref.current?.setState('Hi', { type: 'text', anchor: 999, head: 999 })
    await expect.element(cmContent).toHaveTextContent('Hi')
    await userEvent.keyboard('!')
    await expect.element(cmContent).toHaveTextContent('Hi!')
  })

  it('renders an image when resolveImageUrl returns a url', async () => {
    await render(
      <MeowdownEditor
        initialMarkdown="![pic](a.png)"
        resolveImageUrl={(src) => `https://cdn/${src}`}
      />,
    )
    await expect.element(page.getByAltText('pic')).toHaveAttribute('src', 'https://cdn/a.png')
  })

  it('does not render an image when resolveImageUrl returns undefined', async () => {
    await render(
      <MeowdownEditor initialMarkdown="![pic](a.png)" resolveImageUrl={() => undefined} />,
    )
    await expect.element(page.getByAltText('pic')).not.toBeInTheDocument()
  })

  it('embeds a pasted YouTube link by default', async () => {
    const ref = createRef<EditorHandle>()
    await render(<MeowdownEditor handleRef={ref} resolveImageUrl={(src) => src} />)
    await pmRoot.click()
    const view = ref.current?.editor?.view
    if (!view) throw new Error('editor not mounted')
    pasteText(view, 'https://www.youtube.com/watch?v=aqz-KE-bpKQ')
    await expect
      .element(pmRoot.getByTestId('youtube-embed'))
      .toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ')
  })

  it('does not embed a pasted link when embedPaste is off', async () => {
    const url = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
    const ref = createRef<EditorHandle>()
    const screen = await render(
      <MeowdownEditor handleRef={ref} resolveImageUrl={(src) => src} embedPaste={false} />,
    )
    await pmRoot.click()
    const view = ref.current?.editor?.view
    if (!view) throw new Error('editor not mounted')
    pasteText(view, url)
    await expect.element(screen.getByText(url)).toBeInTheDocument()
    await expect.element(pmRoot.getByTestId('youtube-embed')).not.toBeInTheDocument()
  })

  it('starts a bullet on Enter after a heading when bulletAfterHeading is on', async () => {
    const ref = createRef<EditorHandle>()
    await render(<MeowdownEditor handleRef={ref} bulletAfterHeading initialMarkdown="# Title" />)
    await pmRoot.click()
    const view = ref.current?.editor?.view
    if (!view) throw new Error('editor not mounted')
    const headingEnd = view.state.doc.child(0).nodeSize - 1
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, headingEnd)))
    view.focus()
    await userEvent.keyboard('{Enter}')
    await expect.element(pmRoot.locate('[data-list-kind="bullet"]')).toBeInTheDocument()
  })

  it('uploads and inserts an image dropped from outside the editor', async () => {
    const onImagePaste = vi.fn(() => 'https://cdn/cat.png')
    const ref = createRef<EditorHandle>()
    const screen = await render(
      <MeowdownEditor
        handleRef={ref}
        initialMarkdown="Drop zone"
        resolveImageUrl={(src) => src}
        onImagePaste={onImagePaste}
      />,
    )
    await expect.element(screen.getByText('Drop zone')).toBeInTheDocument()

    // Simulate a Finder drop: a synthetic `drop` carrying an image File, aimed
    // at the paragraph so ProseKit's drop-indicator also claims the position.
    const target = pmRoot.getByText('Drop zone').element()
    const rect = target.getBoundingClientRect()
    const file = new File(['cat'], 'cat.png', { type: 'image/png' })
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    pmRoot.element().dispatchEvent(
      new DragEvent('drop', {
        dataTransfer,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
        cancelable: true,
      }),
    )

    await vi.waitFor(() => expect(onImagePaste).toHaveBeenCalledWith(file))
    await vi.waitFor(() => expect(ref.current?.getMarkdown()).toContain('![](https://cdn/cat.png)'))
  })

  it('shows placeholder text in an empty editor and hides it once typed', async () => {
    const placeholder = page.locate('.prosekit-placeholder')
    await render(<MeowdownEditor placeholder="Write something" />)
    await expect.element(placeholder).toHaveAttribute('data-placeholder', 'Write something')

    await pmRoot.click()
    await userEvent.keyboard('hi')
    await expect.element(placeholder).not.toBeInTheDocument()
  })

  it('does not show the placeholder when the document is not empty', async () => {
    const placeholder = page.locate('.prosekit-placeholder')
    const screen = await render(
      <MeowdownEditor placeholder="Write something" initialMarkdown="hello" />,
    )
    await expect.element(screen.getByText('hello')).toBeInTheDocument()
    await expect.element(placeholder).not.toBeInTheDocument()
  })

  it('makes the rich editor read-only and restores it when toggled off', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<MeowdownEditor handleRef={ref} initialMarkdown="Hi" readOnly />)
    await expect.element(screen.getByText('Hi')).toBeInTheDocument()
    await pmRoot.click()
    await userEvent.keyboard('X')
    expect(ref.current?.getMarkdown()).toBe('Hi\n')

    await screen.rerender(<MeowdownEditor handleRef={ref} initialMarkdown="Hi" readOnly={false} />)
    await pmRoot.click()
    await userEvent.keyboard('Y')
    expect(ref.current?.getMarkdown()).toContain('Y')
  })

  it('makes the source editor read-only', async () => {
    const ref = createRef<EditorHandle>()
    await render(<MeowdownEditor handleRef={ref} mode="source" initialMarkdown="Hi" readOnly />)
    await expect.element(cmContent).toHaveTextContent('Hi')
    await cmContent.click()
    await userEvent.keyboard('X')
    expect(ref.current?.getMarkdown()).toBe('Hi')
  })

  it('exposes the underlying editor on the handle in rich modes only', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<MeowdownEditor handleRef={ref} initialMarkdown="Hi" />)
    await expect.element(screen.getByText('Hi')).toBeInTheDocument()
    expect(ref.current?.editor).toBeTruthy()
    expect(ref.current?.editor?.state.doc.textContent).toBe('Hi')

    await screen.rerender(<MeowdownEditor handleRef={ref} mode="source" initialMarkdown="Hi" />)
    expect(ref.current?.editor).toBeUndefined()
  })

  it('applies editorClassName and wrapperClassName', async () => {
    await render(
      <MeowdownEditor
        initialMarkdown="Hi"
        editorClassName="test-editable"
        wrapperClassName="test-wrap"
      />,
    )
    await expect.element(pmRoot).toHaveClass('test-editable')
    await expect.element(page.locate('.test-wrap')).toBeInTheDocument()
  })

  it('renders children inside the ProseKit context in rich modes', async () => {
    await render(
      <MeowdownEditor initialMarkdown="Hi">
        <EditorProbe />
      </MeowdownEditor>,
    )
    await expect.element(page.getByTestId('probe')).toHaveTextContent('has-editor')
  })

  it('calls onWikilinkClick when a rendered wiki link is clicked', async () => {
    const onWikilinkClick = vi.fn()
    const screen = await render(
      <MeowdownEditor initialMarkdown="see [[Note]] here" onWikilinkClick={onWikilinkClick} />,
    )
    await screen.getByText('Note').click()
    await vi.waitFor(() => {
      expect(onWikilinkClick).toHaveBeenCalledWith(expect.objectContaining({ target: 'Note' }))
    })
  })

  it('calls onLinkClick when a rendered Markdown link is clicked', async () => {
    const onLinkClick = vi.fn()
    const screen = await render(
      <MeowdownEditor
        initialMarkdown="see [Docs](https://example.com) here"
        onLinkClick={onLinkClick}
      />,
    )
    await screen.getByText('Docs').click()
    await vi.waitFor(() => {
      expect(onLinkClick).toHaveBeenCalledWith(
        expect.objectContaining({ href: 'https://example.com' }),
      )
    })
  })

  it('does not render children in source mode', async () => {
    await render(
      <MeowdownEditor mode="source" initialMarkdown="Hi">
        <EditorProbe />
      </MeowdownEditor>,
    )
    await expect.element(cmRoot).toBeInTheDocument()
    await expect.element(page.getByTestId('probe')).not.toBeInTheDocument()
  })

  it('focuses and scrolls via the handle in both editors', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<MeowdownEditor handleRef={ref} initialMarkdown="Hi" />)
    await expect.element(screen.getByText('Hi')).toBeInTheDocument()

    ref.current?.focus()
    ref.current?.scrollIntoView()
    await userEvent.keyboard('!')
    await expect.element(screen.getByText('!Hi')).toBeInTheDocument()

    await screen.rerender(<MeowdownEditor handleRef={ref} mode="source" initialMarkdown="Hi" />)
    ref.current?.focus()
    ref.current?.scrollIntoView()
    await userEvent.keyboard('A')
    await expect.element(cmContent).toHaveTextContent('A!Hi')
  })
})
