import '../testing/index.ts'

import type { FileClickHandler } from '@meowdown/core'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

import { MarkdownView } from './markdown-view.tsx'
import { ProseKitEditor } from './prosekit-editor.tsx'

const view = page.getByTestId('markdown-view')
const wikilink = view.getByTestId('wikilink')

function renderView(markdown: string, props: Record<string, unknown> = {}) {
  return render(
    <div data-testid="markdown-view">
      <MarkdownView markdown={markdown} {...props} />
    </div>,
  )
}

describe('MarkdownView', () => {
  it('renders inline marks as rich text, not source', async () => {
    await renderView('**bold** and *italic* and `code`')
    // The bug renders these as plain `**bold**` text with no element; rich
    // rendering produces real strong/em/code elements.
    await expect.element(view.locate('strong').first()).toBeInTheDocument()
    await expect.element(view.locate('em').first()).toBeInTheDocument()
    await expect.element(view.locate('code').first()).toBeInTheDocument()
  })

  it('renders a wikilink as a chip showing the target', async () => {
    await renderView('[[Reflect Playground 4]]')
    await expect.element(wikilink).toHaveTextContent('Reflect Playground 4')
  })

  it('renders a wikilink alias', async () => {
    await renderView('[[target|Alias]]')
    await expect.element(wikilink).toHaveTextContent('Alias')
  })

  it('calls onWikilinkClick with the target', async () => {
    const onWikilinkClick = vi.fn()
    await renderView('[[Note]]', { onWikilinkClick })
    await wikilink.click()
    expect(onWikilinkClick).toHaveBeenCalledTimes(1)
    expect(onWikilinkClick).toHaveBeenCalledWith(expect.objectContaining({ target: 'Note' }))
  })

  it('renders an image preview', async () => {
    await renderView('![cat](https://example.com/cat.png)')
    const img = view.getByTestId('image-preview').locate('img')
    await expect.element(img).toHaveAttribute('src', 'https://example.com/cat.png')
    await expect.element(img).toHaveAttribute('alt', 'cat')
  })

  it('renders a resolved wiki image with its alias and width', async () => {
    await renderView('![[assets/cat.png|120]]', {
      resolveWikiEmbed: () => ({ kind: 'image' }),
      resolveImageUrl: (src: string) => `asset://${src}`,
    })
    const img = view.getByTestId('image-preview').locate('img')
    await expect.element(img).toHaveAttribute('src', 'asset://assets/cat.png')
    await expect.element(img).toHaveAttribute('alt', 'cat.png')
    await expect.element(img).toHaveStyle({ width: '120px' })
  })

  it('renders a resolved wiki file as a pill and reports clicks', async () => {
    const onFileClick = vi.fn()
    await renderView('![[docs/report.pdf|Quarterly]]', {
      resolveWikiEmbed: () => ({ kind: 'file' }),
      resolveFileInfo: () => ({ size: 1_400_000 }),
      onFileClick,
    })
    const pill = view.getByTestId('file-pill')
    await expect.element(pill).toHaveTextContent('Quarterly')
    await expect.element(view.getByTestId('file-pill-size')).toHaveTextContent('1.4 MB')
    await pill.click()
    expect(onFileClick).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'docs/report.pdf', name: 'Quarterly' }),
    )
  })

  it('renders a claimed standard Markdown file link as a pill', async () => {
    const resolveFileLink = vi.fn(({ href }: { href: string }) => href.startsWith('docs/'))
    await renderView('[Quarterly](docs/report.pdf "Report")', { resolveFileLink })

    await expect.element(view.getByTestId('file-pill')).toHaveTextContent('Quarterly')
    expect(view.element().querySelector('a')).toBeNull()
    expect(resolveFileLink).toHaveBeenCalledWith({
      href: 'docs/report.pdf',
      label: 'Quarterly',
      title: 'Report',
    })
  })

  it('leaves an unclaimed standard Markdown link as a link', async () => {
    await renderView('[Website](https://example.com)', { resolveFileLink: () => false })

    await expect.element(view.locate('a')).toHaveAttribute('href', 'https://example.com')
    expect(view.element().querySelector('[data-testid="file-pill"]')).toBeNull()
  })

  it('resolves metadata for a claimed standard Markdown file link', async () => {
    const resolveFileInfo = vi.fn(() => ({ size: 1_400_000 }))
    await renderView('[Quarterly](docs/report.pdf)', {
      resolveFileLink: () => true,
      resolveFileInfo,
    })

    await expect.element(view.getByTestId('file-pill-size')).toHaveTextContent('1.4 MB')
    expect(resolveFileInfo).toHaveBeenCalledExactlyOnceWith('docs/report.pdf')
  })

  it('reports clicks on a claimed standard Markdown file link', async () => {
    const onFileClick = vi.fn<FileClickHandler>()
    await renderView('[Quarterly](docs/report.pdf)', {
      resolveFileLink: () => true,
      onFileClick,
    })

    await view.getByTestId('file-pill').click()
    expect(onFileClick).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'docs/report.pdf', name: 'Quarterly' }),
    )
    expect(onFileClick.mock.calls[0][0].event).toBeInstanceOf(MouseEvent)
  })

  it('keeps a claimed standard file pill passive when interactive is false', async () => {
    const onFileClick = vi.fn()
    await renderView('[Quarterly](docs/report.pdf)', {
      interactive: false,
      resolveFileLink: () => true,
      onFileClick,
    })

    const pill = view.getByTestId('file-pill')
    await expect.element(pill).toHaveTextContent('Quarterly')
    expect(view.element().querySelector('a')).toBeNull()
    await pill.click()
    expect(onFileClick).not.toHaveBeenCalled()
  })

  it('renders a resolved wiki note through the wikilink hook', async () => {
    const onWikilinkClick = vi.fn()
    await renderView('![[Projects/Plan|Launch plan]]', {
      resolveWikiEmbed: () => ({ kind: 'note' }),
      onWikilinkClick,
    })
    await expect.element(wikilink).toHaveTextContent('Launch plan')
    await wikilink.click()
    expect(onWikilinkClick).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'Projects/Plan' }),
    )
  })

  it('leaves an unresolved wiki embed literal', async () => {
    await renderView('![[ambiguous.png]]', { resolveWikiEmbed: () => undefined })
    await expect.element(view).toHaveTextContent('![[ambiguous.png]]')
    expect(view.element().querySelector('.md-atom-view')).toBeNull()
  })

  it('renders a tweet embed', async () => {
    await renderView('![](https://x.com/jack/status/20)')
    const iframe = view.getByTestId('tweet-embed')
    await expect.element(iframe).toBeInTheDocument()
    await expect
      .element(iframe)
      .toHaveAttribute(
        'src',
        expect.stringContaining('platform.twitter.com/embed/Tweet.html?id=20'),
      )
  })

  it('renders a youtube embed', async () => {
    await renderView('![](https://youtu.be/dQw4w9WgXcQ)')
    const iframe = view.getByTestId('youtube-embed')
    await expect.element(iframe).toBeInTheDocument()
    await expect
      .element(iframe)
      .toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('omits recognized embeds before resolving images when interactive is false', async () => {
    const resolveImageUrl = vi.fn((src: string) => src)
    await renderView('![](https://x.com/jack/status/20)\n\n![](https://youtu.be/dQw4w9WgXcQ)', {
      interactive: false,
      resolveImageUrl,
    })

    expect(view.element().querySelector('iframe')).toBeNull()
    expect(resolveImageUrl).not.toHaveBeenCalled()
  })

  it('renders a passive tree when interactive is false', async () => {
    const onWikilinkClick = vi.fn()
    const onLinkClick = vi.fn()
    const onImageClick = vi.fn()
    const onFileClick = vi.fn()
    const onTaskClick = vi.fn()
    await renderView(
      '[[Note]] [Docs](https://example.com) ![cat](https://example.com/cat.png) ![[report.pdf]]\n\n![](https://x.com/jack/status/20)\n\n+ [ ] task',
      {
        interactive: false,
        resolveWikiEmbed: () => ({ kind: 'file' }),
        onWikilinkClick,
        onLinkClick,
        onImageClick,
        onFileClick,
        onTaskClick,
      },
    )

    const root = view.element()
    expect(root.querySelector('a')).toBeNull()
    expect(root.querySelector('iframe')).toBeNull()
    expect(
      root.querySelectorAll(
        'button, input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).toHaveLength(0)
    await wikilink.click()
    await view.getByText('Docs').click()
    await view.getByAltText('cat').click()
    await view.getByTestId('file-pill').click()
    expect(onWikilinkClick).not.toHaveBeenCalled()
    expect(onLinkClick).not.toHaveBeenCalled()
    expect(onImageClick).not.toHaveBeenCalled()
    expect(onFileClick).not.toHaveBeenCalled()
    expect(onTaskClick).not.toHaveBeenCalled()
  })

  it('highlights a code block with syntax tokens', async () => {
    await renderView('```rust\nfn main() {}\n```')
    await expect
      .element(view.locate('pre code [class*="tok-"]').first(), { timeout: 15000 })
      .toBeInTheDocument()
  })

  it('applies a custom mark mode to the root', async () => {
    await renderView('hello', { markMode: 'show' })
    await expect.element(view.locate('.ProseMirror')).toHaveAttribute('data-mark-mode', 'show')
  })

  it('defaults to hide mark mode', async () => {
    await renderView('hello')
    await expect.element(view.locate('.ProseMirror')).toHaveAttribute('data-mark-mode', 'hide')
  })

  it('renders headings, lists and blockquotes', async () => {
    await renderView('# Title\n\n- one\n- two\n\n> quote')
    await expect.element(view.locate('h1')).toHaveTextContent('Title')
    // flat-list renders list items as `div.prosemirror-flat-list`, like the editor.
    await expect.element(view.locate('.prosemirror-flat-list').first()).toHaveTextContent('one')
    await expect.element(view.locate('blockquote')).toHaveTextContent('quote')
  })

  it('folds a collapsed bullet, like the editor', async () => {
    await renderView('+ parent\n  - child')
    await expect.element(view.locate('[data-list-collapsed]')).toHaveTextContent('parent')
    await expect.element(view.getByText('child')).not.toBeVisible()
  })

  it('renders a collapsed bullet expanded with expandCollapsed', async () => {
    await renderView('+ parent\n  - child', { expandCollapsed: true })
    await expect.element(view.getByText('child')).toBeVisible()
    await expect.element(view.locate('[data-list-collapsed]')).not.toBeInTheDocument()
  })

  it('expands collapsed bullets at every depth', async () => {
    await renderView('+ parent\n  + middle\n    - leaf', { expandCollapsed: true })
    await expect.element(view.getByText('leaf')).toBeVisible()
    await expect.element(view.locate('[data-list-collapsed]')).not.toBeInTheDocument()
  })

  it('keeps a circle task round under expandCollapsed', async () => {
    await renderView('+ [ ] task\n  - child', { expandCollapsed: true })
    const circleTask = view.locate('[data-list-marker="+"]')
    await expect.element(circleTask.locate('input[type="checkbox"]')).toBeInTheDocument()
    await expect.element(view.getByText('child')).toBeVisible()
  })

  it('renders truncated markdown without throwing', async () => {
    await renderView('foo [[Bar and a **bold')
    await expect.element(view).toHaveTextContent('foo')
  })

  it('renders task checkboxes with their checked state', async () => {
    await renderView('+ [ ] open\n+ [x] done')
    const boxes = view.locate('input[type="checkbox"]')
    await expect.element(boxes.first()).not.toBeChecked()
    await expect.element(boxes.last()).toBeChecked()
  })

  it('calls onTaskClick with the document-order index and task facts', async () => {
    const onTaskClick = vi.fn()
    await renderView('+ [ ] first\n+ [x] **second** [[Note]]\n- [ ] square', { onTaskClick })
    await view.locate('input[type="checkbox"]').nth(1).click()
    expect(onTaskClick).toHaveBeenCalledTimes(1)
    expect(onTaskClick).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 1,
        checked: true,
        marker: '+',
        text: '**second** [[Note]]',
      }),
    )
    await view.locate('input[type="checkbox"]').nth(2).click()
    expect(onTaskClick).toHaveBeenLastCalledWith(
      expect.objectContaining({ index: 2, checked: false, marker: '-', text: 'square' }),
    )
  })

  it('numbers a nested task after its parent, in document order', async () => {
    const onTaskClick = vi.fn()
    await renderView('+ [ ] parent\n  + [ ] child\n+ [ ] after', { onTaskClick })
    await view.locate('input[type="checkbox"]').nth(1).click()
    expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ index: 1, text: 'child' }))
    await view.locate('input[type="checkbox"]').nth(2).click()
    expect(onTaskClick).toHaveBeenLastCalledWith(
      expect.objectContaining({ index: 2, text: 'after' }),
    )
  })

  it('never flips a clicked checkbox itself', async () => {
    const onTaskClick = vi.fn()
    await renderView('+ [ ] open', { onTaskClick })
    const box = view.locate('input[type="checkbox"]')
    await expect.element(box, { timeout: 2000 }).not.toBeChecked()
    expect(onTaskClick).toHaveBeenCalledTimes(0)
    await box.click()
    await expect.element(box, { timeout: 2000 }).not.toBeChecked()
    expect(onTaskClick).toHaveBeenCalledTimes(1)
  })

  it('keeps checkboxes inert without an onTaskClick handler', async () => {
    await renderView('+ [x] done')
    const box = view.locate('input[type="checkbox"]')
    await box.click()
    await expect.element(box).toBeChecked()
  })

  it('re-seats checkbox state when the markdown prop changes', async () => {
    const screen = await renderView('+ [ ] task')
    const box = view.locate('input[type="checkbox"]')
    await expect.element(box).not.toBeChecked()
    await screen.rerender(
      <div data-testid="markdown-view">
        <MarkdownView markdown="+ [x] task" />
      </div>,
    )
    await expect.element(box).toBeChecked()
  })

  it('updates when the markdown prop changes', async () => {
    const screen = await renderView('first')
    await expect.element(view).toHaveTextContent('first')
    await screen.rerender(
      <div data-testid="markdown-view">
        <MarkdownView markdown="second" />
      </div>,
    )
    await expect.element(view).toHaveTextContent('second')
  })
})

// Strip editor-only attributes and sort the rest, so two DOM subtrees compare
// equal regardless of attribute order or ProseMirror's editing affordances.
function canonicalize(root: Element): string {
  const SKIP = new Set([
    'contenteditable',
    'translate',
    'draggable',
    'spellcheck',
    'tabindex',
    'readonly',
  ])
  const walk = (node: ChildNode): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as Element
    if (el.tagName === 'BR' && el.classList.contains('ProseMirror-trailingBreak')) return ''
    const attrs = Array.from(el.attributes)
      .filter((attr) => !SKIP.has(attr.name) && !(attr.name === 'class' && attr.value === ''))
      // A style attribute set from an HTML string keeps its original spacing,
      // while one round-tripped through the DOM is reformatted; KaTeX output
      // hits both paths, so compare styles whitespace-free.
      .map((attr) => {
        const value = attr.name === 'style' ? attr.value.replaceAll(/\s+/g, '') : attr.value
        return `${attr.name}=${JSON.stringify(value)}`
      })
      .sort()
    const children = Array.from(el.childNodes).map(walk).join('')
    return `<${el.tagName.toLowerCase()} ${attrs.join(' ')}>${children}</${el.tagName.toLowerCase()}>`
  }
  return Array.from(root.childNodes).map(walk).join('')
}

describe('MarkdownView math', () => {
  it('renders inline math as KaTeX', async () => {
    await renderView('a $E=mc^2$ b')
    await expect.element(view.getByTestId('math-preview').locate('.katex')).toBeInTheDocument()
  })

  it('renders a dollar math block as a display formula', async () => {
    await renderView('$$\nE=mc^2\n$$')
    await expect
      .element(view.getByTestId('code-block-math-preview').locate('.katex'))
      .toBeInTheDocument()
  })

  it('renders a math fence as a display formula', async () => {
    await renderView('```math\nE=mc^2\n```')
    await expect
      .element(view.getByTestId('code-block-math-preview').locate('.katex'))
      .toBeInTheDocument()
  })
})

describe('MarkdownView Mermaid', () => {
  const mermaidPreview = view.getByTestId('code-block-mermaid-preview')

  it('renders a Flowchart as SVG', async () => {
    await renderView('```mermaid\nflowchart LR\n  A[Start] --> B[End]\n```')

    await expect.element(mermaidPreview.locate('svg'), { timeout: 15000 }).toBeInTheDocument()
    await expect.element(mermaidPreview).toHaveTextContent('Start')
    await expect.element(mermaidPreview).toHaveTextContent('End')
  })

  it('renders a Sequence diagram as SVG', async () => {
    await renderView('```mermaid\nsequenceDiagram\n  Alice->>Bob: Hello Bob\n```')

    await expect.element(mermaidPreview.locate('svg'), { timeout: 15000 }).toBeInTheDocument()
    await expect.element(mermaidPreview).toHaveTextContent('Hello Bob')
  })

  it('renders unsupported syntax as an error', async () => {
    await renderView('```mermaid\npie\n  "Dogs" : 10\n```')

    await expect.element(mermaidPreview, { timeout: 15000 }).toHaveAttribute('data-error')
    await expect.element(mermaidPreview).toHaveTextContent(/Invalid|Unsupported/i)
  })

  it('renders passive SVG when interaction is disabled', async () => {
    await renderView('```mermaid\nflowchart LR\n  A --> B\n```', { interactive: false })

    await expect.element(mermaidPreview.locate('svg'), { timeout: 15000 }).toBeInTheDocument()
    await expect
      .element(mermaidPreview.locate('a, button, input, select, textarea, [tabindex], [href]'))
      .not.toBeInTheDocument()
    await expect
      .element(mermaidPreview.locate('[onclick], [onmouseover], [onerror], [onload]'))
      .not.toBeInTheDocument()
  })
})

describe('MarkdownView parity with the editor', () => {
  const editorHost = page.getByTestId('parity-editor')
  const staticHost = page.getByTestId('parity-static')
  // A rich element appears once marks are applied (editor) or on first render
  // (static); waiting on it avoids reading the DOM mid-render.
  const richSelector = 'strong, em, code, del, .md-tag, .md-link, .md-wikilink-view-label'

  it.each([
    '**bold** text',
    '*italic* and `code` and ~~strike~~',
    'a #tag here',
    'link [text](https://example.com) end',
    'a [[Note]] and [[target|Alias]] inline',
    '+ [ ] circle **task**',
    '- [x] square **done**',
  ])('matches the editor for %s', async (markdown) => {
    await render(
      <div data-testid="parity-editor">
        <ProseKitEditor initialMarkdown={markdown} markMode="hide" readOnly />
      </div>,
    )
    await render(
      <div data-testid="parity-static">
        <MarkdownView markdown={markdown} />
      </div>,
    )
    await expect.element(editorHost.locate(richSelector).first()).toBeInTheDocument()
    await expect.element(staticHost.locate(richSelector).first()).toBeInTheDocument()

    const editorRoot = editorHost.locate('.ProseMirror').element()
    const staticRoot = staticHost.locate('.ProseMirror').element()
    expect(canonicalize(staticRoot)).toBe(canonicalize(editorRoot))
  })

  it('matches the editor for inline math', async () => {
    const markdown = 'a $E=mc^2$ b'
    await render(
      <div data-testid="parity-editor">
        <ProseKitEditor initialMarkdown={markdown} markMode="hide" readOnly />
      </div>,
    )
    await render(
      <div data-testid="parity-static">
        <MarkdownView markdown={markdown} />
      </div>,
    )
    // KaTeX renders asynchronously in both hosts; wait for each before diffing.
    await expect.element(editorHost.locate('.katex').first()).toBeInTheDocument()
    await expect.element(staticHost.locate('.katex').first()).toBeInTheDocument()

    const editorRoot = editorHost.locate('.ProseMirror').element()
    const staticRoot = staticHost.locate('.ProseMirror').element()
    expect(canonicalize(staticRoot)).toBe(canonicalize(editorRoot))
  })

  it('matches the editor for a Mermaid diagram', async () => {
    const markdown = 'before\n\n```mermaid\nflowchart LR\n  A[Start] --> B[End]\n```'
    await render(
      <div data-testid="parity-editor">
        <ProseKitEditor initialMarkdown={markdown} markMode="hide" readOnly />
      </div>,
    )
    await render(
      <div data-testid="parity-static">
        <MarkdownView markdown={markdown} />
      </div>,
    )
    const editorPreview = editorHost.getByTestId('code-block-mermaid-preview')
    const staticPreview = staticHost.getByTestId('code-block-mermaid-preview')
    await expect.element(editorPreview.locate('svg'), { timeout: 15000 }).toBeInTheDocument()
    await expect.element(staticPreview.locate('svg'), { timeout: 15000 }).toBeInTheDocument()

    expect(canonicalize(staticPreview.element())).toBe(canonicalize(editorPreview.element()))
  })
})
