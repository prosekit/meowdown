import '../testing/index.ts'

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

  it('renders truncated markdown without throwing', async () => {
    await renderView('foo [[Bar and a **bold')
    await expect.element(view).toHaveTextContent('foo')
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
  const SKIP = new Set(['contenteditable', 'translate', 'draggable', 'spellcheck', 'tabindex'])
  const walk = (node: ChildNode): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as Element
    if (el.tagName === 'BR' && el.classList.contains('ProseMirror-trailingBreak')) return ''
    const attrs = Array.from(el.attributes)
      .filter((attr) => !SKIP.has(attr.name) && !(attr.name === 'class' && attr.value === ''))
      .map((attr) => `${attr.name}=${JSON.stringify(attr.value)}`)
      .sort()
    const children = Array.from(el.childNodes).map(walk).join('')
    return `<${el.tagName.toLowerCase()} ${attrs.join(' ')}>${children}</${el.tagName.toLowerCase()}>`
  }
  return Array.from(root.childNodes).map(walk).join('')
}

describe('MarkdownView parity with the editor', () => {
  const editorHost = page.getByTestId('parity-editor')
  const staticHost = page.getByTestId('parity-static')
  // A rich element appears once marks are applied (editor) or on first render
  // (static); waiting on it avoids reading the DOM mid-render.
  const richSelector = 'strong, em, code, del, .md-tag, .md-link, .md-wikilink-view-label-v2'

  it.each([
    '**bold** text',
    '*italic* and `code` and ~~strike~~',
    'a #tag here',
    'link [text](https://example.com) end',
    'a [[Note]] and [[target|Alias]] inline',
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
})
