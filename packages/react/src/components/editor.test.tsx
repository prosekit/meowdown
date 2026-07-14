import '../testing/index.ts'

import { dropFiles } from '@meowdown/vitest/file-events'
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
  })

  it('keeps the ProseKit editor instance when switching among rich modes', async () => {
    const screen = await render(<MeowdownEditor mode="focus" />)

    await pmRoot.click()
    await userEvent.keyboard('abc')

    await screen.rerender(<MeowdownEditor mode="show" />)
    await expect.element(screen.getByText('abc')).toBeInTheDocument()
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'show')
  })

  it('notifies onDocChange and exposes markdown via the ref', async () => {
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
  })

  it('replaces content via setMarkdown', async () => {
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
    const screen = await render(<MeowdownEditor handleRef={ref} initialMarkdown="hello" />)
    await expect.element(screen.getByText('hello')).toBeInTheDocument()

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

  it('renders a resolved wiki image and leaves an unresolved one literal', async () => {
    const resolveWikiEmbed = ({ target }: { target: string }) =>
      target === 'photo.png' ? ({ kind: 'image' } as const) : undefined
    await render(
      <MeowdownEditor
        initialMarkdown={'![[photo.png|Photo]] ![[ambiguous.png]]'}
        resolveWikiEmbed={resolveWikiEmbed}
        resolveImageUrl={(src) => `https://cdn/${src}`}
      />,
    )
    await expect.element(page.getByAltText('Photo')).toHaveAttribute('src', 'https://cdn/photo.png')
    await expect.element(pmRoot).toHaveTextContent('![[ambiguous.png]]')
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
    const onFilePaste = vi.fn(() => 'https://cdn/cat.png')
    const ref = createRef<EditorHandle>()
    const screen = await render(
      <MeowdownEditor
        handleRef={ref}
        initialMarkdown="Drop zone"
        resolveImageUrl={(src) => src}
        onFilePaste={onFilePaste}
      />,
    )
    await expect.element(screen.getByText('Drop zone')).toBeInTheDocument()

    const view = ref.current?.editor?.view
    if (!view) throw new Error('editor not mounted')
    // Simulate a Finder drop: a synthetic `drop` carrying an image File, aimed
    // at the paragraph so ProseKit's drop-indicator also claims the position.
    const file = new File(['cat'], 'cat.png', { type: 'image/png' })
    dropFiles(view, [file], 1)

    await vi.waitFor(() => expect(onFilePaste).toHaveBeenCalledWith(file))
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

  it('exposes the underlying editor on the handle', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<MeowdownEditor handleRef={ref} initialMarkdown="Hi" />)
    await expect.element(screen.getByText('Hi')).toBeInTheDocument()
    expect(ref.current?.editor).toBeTruthy()
    expect(ref.current?.editor?.state.doc.textContent).toBe('Hi')
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
    await screen.getByTestId('wikilink').click()
    await vi.waitFor(() => {
      expect(onWikilinkClick).toHaveBeenCalledWith(expect.objectContaining({ target: 'Note' }))
    })
  })

  it('calls onImageClick when a rendered image is clicked', async () => {
    const onImageClick = vi.fn()
    const screen = await render(
      <MeowdownEditor
        initialMarkdown="![pic](https://example.com/a.png)"
        resolveImageUrl={(src) => src}
        onImageClick={onImageClick}
      />,
    )
    await screen.getByAltText('pic').click()
    await vi.waitFor(() => {
      expect(onImageClick).toHaveBeenCalledWith(
        expect.objectContaining({ src: 'https://example.com/a.png', alt: 'pic' }),
      )
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

  it('round-trips and activates a resolved reference link', async () => {
    const onLinkClick = vi.fn()
    const ref = createRef<EditorHandle>()
    const markdown = '[Plan][doc], [doc][], and [doc].\n\n[doc]: docs/plan.md "Plan title"'
    await render(
      <MeowdownEditor
        handleRef={ref}
        mode="hide"
        initialMarkdown={markdown}
        onLinkClick={onLinkClick}
      />,
    )

    expect(ref.current?.getMarkdown()).toBe(`${markdown}\n`)
    const links = pmRoot.getByRole('link')
    await expect.element(links.first()).toHaveAttribute('href', 'docs/plan.md')
    await links.first().click()
    await vi.waitFor(() => {
      expect(onLinkClick).toHaveBeenCalledWith(expect.objectContaining({ href: 'docs/plan.md' }))
    })
  })

  it('renders a reference image from its resolved definition destination', async () => {
    const onImageClick = vi.fn()
    const markdown = '![Preview][asset]\n\n[asset]: assets/preview.png "Preview image"'
    await render(
      <MeowdownEditor
        mode="hide"
        initialMarkdown={markdown}
        resolveImageUrl={(src) => `asset://${src}`}
        onImageClick={onImageClick}
      />,
    )

    const image = page.getByAltText('Preview')
    await expect.element(image).toHaveAttribute('src', 'asset://assets/preview.png')
    await image.click()
    expect(onImageClick).toHaveBeenCalledWith(
      expect.objectContaining({ src: 'assets/preview.png', alt: 'Preview' }),
    )
  })

  it('calls onTagClick when a rendered tag is clicked', async () => {
    const onTagClick = vi.fn()
    const screen = await render(
      <MeowdownEditor initialMarkdown="see #hello here" onTagClick={onTagClick} />,
    )
    await screen.getByText('#hello').click()
    await vi.waitFor(() => {
      expect(onTagClick).toHaveBeenCalledWith(expect.objectContaining({ tag: 'hello' }))
    })
  })

  it('calls onExitBoundary with "up" when ArrowUp is pressed at the top', async () => {
    const onExitBoundary = vi.fn()
    const screen = await render(
      <MeowdownEditor initialMarkdown="only line" onExitBoundary={onExitBoundary} />,
    )
    await screen.getByText('only line').click()
    await userEvent.keyboard('{ArrowUp}')
    await vi.waitFor(() => {
      expect(onExitBoundary).toHaveBeenCalledWith(expect.objectContaining({ direction: 'up' }))
    })
  })

  it('does not call onExitBoundary from a middle paragraph', async () => {
    const onExitBoundary = vi.fn()
    const screen = await render(
      <MeowdownEditor initialMarkdown={'one\n\ntwo\n\nthree'} onExitBoundary={onExitBoundary} />,
    )
    await screen.getByText('two').click()
    await userEvent.keyboard('{ArrowUp}')
    expect(onExitBoundary).not.toHaveBeenCalled()
  })

  it('focuses and scrolls via the handle', async () => {
    const ref = createRef<EditorHandle>()
    const screen = await render(<MeowdownEditor handleRef={ref} initialMarkdown="Hi" />)
    await expect.element(screen.getByText('Hi')).toBeInTheDocument()

    ref.current?.focus()
    ref.current?.scrollIntoView()
    await userEvent.keyboard('!')
    await expect.element(screen.getByText('!Hi')).toBeInTheDocument()
  })

  it('reveals a URL-decoded heading through the handle', async () => {
    const ref = createRef<EditorHandle>()
    await render(
      <MeowdownEditor
        handleRef={ref}
        initialMarkdown={'# First\n\nBody\n\n## **Target Heading**\n\nTail'}
      />,
    )

    expect(ref.current?.revealHeading('#target%20heading')).toBe(true)
    const editor = ref.current?.editor
    if (!editor) throw new Error('editor not mounted')
    expect(editor.state.selection.$from.parent.type.name).toBe('heading')
    expect(editor.state.selection.$from.parent.textContent).toBe('**Target Heading**')
  })

  it('reveals GitHub-style heading slugs, including duplicate suffixes', async () => {
    const ref = createRef<EditorHandle>()
    await render(
      <MeowdownEditor
        handleRef={ref}
        initialMarkdown={'## Target Heading!\n\nBody\n\n## Target Heading!'}
      />,
    )

    expect(ref.current?.revealHeading('#target-heading-1')).toBe(true)
    const editor = ref.current?.editor
    if (!editor) throw new Error('editor not mounted')
    expect(editor.state.selection.$from.parent.type.name).toBe('heading')
    expect(editor.state.selection.$from.before()).toBe(
      editor.state.doc.child(0).nodeSize + editor.state.doc.child(1).nodeSize,
    )
  })

  it('reports a missing heading without moving the selection', async () => {
    const ref = createRef<EditorHandle>()
    await render(<MeowdownEditor handleRef={ref} initialMarkdown={'# First\n\nBody'} />)
    const before = ref.current?.getSelection()
    expect(ref.current?.revealHeading('#Missing')).toBe(false)
    expect(ref.current?.getSelection()).toEqual(before)
  })

  it('refreshes creation-time resolver output without changing Markdown or selection', async () => {
    const ref = createRef<EditorHandle>()
    let resolved = false
    await render(
      <MeowdownEditor
        handleRef={ref}
        initialMarkdown="before ![[photo.png]] after"
        resolveWikiEmbed={() => (resolved ? { kind: 'image' } : undefined)}
        resolveImageUrl={(src) => `https://cdn.example/${src}`}
      />,
    )
    ref.current?.setSelection({ type: 'text', anchor: 3, head: 3 })
    const before = ref.current?.getState()
    const image = page.getByAltText('photo.png')
    await expect.element(image).not.toBeInTheDocument()

    resolved = true
    ref.current?.refreshMarkdownRendering()

    await expect.element(image).toBeInTheDocument()
    expect(ref.current?.getState()).toEqual(before)
  })
})

describe('file pill props', () => {
  const claimAssets = ({ href }: { href: string }) => href.startsWith('assets/')

  it('renders a claimed link as a pill with its resolved size and reports clicks', async () => {
    const onFileClick = vi.fn()
    await render(
      <MeowdownEditor
        mode="hide"
        initialMarkdown="[report.pdf](assets/report.pdf)"
        resolveFileLink={claimAssets}
        resolveFileInfo={() => Promise.resolve({ size: 1_400_000 })}
        onFileClick={onFileClick}
      />,
    )
    const pill = pmRoot.getByTestId('file-pill')
    await expect.element(pill).toHaveTextContent('report.pdf')
    await expect.element(pmRoot.getByTestId('file-pill-size')).toHaveTextContent('1.4 MB')
    await userEvent.click(pill)
    await vi.waitFor(() => {
      expect(onFileClick).toHaveBeenCalledWith(
        expect.objectContaining({ href: 'assets/report.pdf', name: 'report.pdf' }),
      )
    })
  })

  it('renders a pasted file as a pill once onFilePaste persists it', async () => {
    const ref = createRef<EditorHandle>()
    await render(
      <MeowdownEditor
        handleRef={ref}
        mode="hide"
        resolveFileLink={claimAssets}
        onFilePaste={(file) => `assets/${file.name}`}
      />,
    )
    const view = ref.current!.editor!.view
    dropFiles(view, [new File(['%PDF'], 'report.pdf', { type: 'application/pdf' })], 1)
    await expect.element(pmRoot.getByTestId('file-pill')).toHaveTextContent('report.pdf')
    expect(ref.current!.getMarkdown()).toBe('[report.pdf](assets/report.pdf)\n')
  })

  it('leaves links as links without resolveFileLink', async () => {
    await render(<MeowdownEditor mode="hide" initialMarkdown="[report.pdf](assets/report.pdf)" />)
    await expect.element(pmRoot.getByRole('link')).toBeInTheDocument()
    expect(pmRoot.getByTestId('file-pill').query()).toBeNull()
  })
})
