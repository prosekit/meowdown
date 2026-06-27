import {
  defaultResolveImageUrl,
  getCodeTokens,
  getMarkBuilders,
  inlineTextToMarkChunks,
  listenForTweetHeight,
  markdownToDoc,
  matchEmbed,
  type CodeBlockAttrs,
  type CodeToken,
  type EmbedDescriptor,
  type ImageClickHandler,
  type LinkClickHandler,
  type MarkChunk,
  type MarkMode,
  type MarkName,
  type MdImageAttrs,
  type MdLinkTextAttrs,
  type MdWikilinkAttrs,
  type NodeName,
  type WikilinkClickHandler,
} from '@meowdown/core'
import { Mark, type Node as ProseMirrorNode } from '@prosekit/pm/model'
import { clsx } from 'clsx/lite'
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react'

import { outputSpecToReact } from './dom-output-spec.tsx'

export interface MarkdownViewProps {
  /** The Markdown to render. Live: changing it re-renders the content. */
  markdown: string
  /** Mark mode for the read-only view. Defaults to `'hide'`. */
  markMode?: MarkMode
  /** Peel a leading YAML frontmatter block before rendering. Off by default. */
  frontmatter?: boolean
  /** Map an image `src` to a displayable URL, or `undefined` to skip it. */
  resolveImageUrl?: (src: string) => string | undefined
  /** Called when a rendered wiki link is clicked. Pass a stable function. */
  onWikilinkClick?: WikilinkClickHandler
  /** Called when a rendered Markdown link is clicked. Pass a stable function. */
  onLinkClick?: LinkClickHandler
  /** Called when a rendered image is clicked. Pass a stable function. */
  onImageClick?: ImageClickHandler
  /** Extra class on the content root (alongside `ProseMirror meowdown-content`). */
  className?: string
}

interface RenderContext {
  resolveImageUrl?: (src: string) => string | undefined
  onWikilinkClick?: WikilinkClickHandler
  onLinkClick?: LinkClickHandler
  onImageClick?: ImageClickHandler
}

function WikilinkChip(props: {
  target: string
  display: string
  onWikilinkClick?: WikilinkClickHandler
  children: ReactNode
}): ReactElement {
  const { target, display, onWikilinkClick, children } = props
  const handleClick = onWikilinkClick
    ? (event: MouseEvent) => onWikilinkClick({ target, event: event.nativeEvent })
    : undefined
  return (
    <span className="md-wikilink-view md-atom-view">
      <span
        className="md-wikilink-view-preview md-atom-view-preview"
        data-testid="wikilink"
        contentEditable={false}
        onClick={handleClick}
      >
        <span className="md-wikilink-view-label" contentEditable={false}>
          {display || target}
        </span>
      </span>
      <span className="md-wikilink-view-content md-atom-view-content">{children}</span>
    </span>
  )
}

function EmbedFrame({ embed }: { embed: EmbedDescriptor }): ReactElement {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    if (embed.kind !== 'tweet') return
    const iframe = iframeRef.current
    if (!iframe) return
    return listenForTweetHeight(iframe)
  }, [embed.kind, embed.key])
  return (
    <span className="md-image-view-preview md-atom-view-preview" contentEditable={false}>
      <iframe
        ref={iframeRef}
        key={embed.key}
        src={embed.src}
        title={embed.title}
        className={embed.className}
        data-testid={embed.testid}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        frameBorder="0"
        allow={embed.allow}
        allowFullScreen={embed.allowFullscreen}
      />
    </span>
  )
}

function ImagePreview(props: {
  src: string
  alt: string
  resolveImageUrl?: (src: string) => string | undefined
  onImageClick?: ImageClickHandler
}): ReactElement | null {
  const { src, alt, resolveImageUrl, onImageClick } = props
  const embed = matchEmbed(src)
  if (embed) return <EmbedFrame embed={embed} />

  const url = (resolveImageUrl ?? defaultResolveImageUrl)(src)
  if (!url) return null
  const handleClick = onImageClick
    ? (event: MouseEvent) => onImageClick({ src, alt, event: event.nativeEvent })
    : undefined
  return (
    <span
      className="md-image-view-preview md-atom-view-preview"
      data-testid="image-preview"
      contentEditable={false}
    >
      <img src={url} alt={alt} draggable={false} onClick={handleClick} />
    </span>
  )
}

function ImageView(props: {
  src: string
  alt: string
  context: RenderContext
  children: ReactNode
}): ReactElement {
  const { src, alt, context, children } = props
  return (
    <span className="md-image-view md-atom-view">
      <ImagePreview
        src={src}
        alt={alt}
        resolveImageUrl={context.resolveImageUrl}
        onImageClick={context.onImageClick}
      />
      <span className="md-image-view-content md-atom-view-content">{children}</span>
    </span>
  )
}

function renderTokens(code: string, tokens: readonly CodeToken[]): ReactNode {
  const out: ReactNode[] = []
  let pos = 0
  let index = 0
  for (const [from, to, classes] of tokens) {
    if (from > pos) out.push(<Fragment key={`gap-${index}`}>{code.slice(pos, from)}</Fragment>)
    out.push(
      <span key={index} className={classes}>
        {code.slice(from, to)}
      </span>,
    )
    pos = to
    index++
  }
  if (pos < code.length) out.push(<Fragment key="tail">{code.slice(pos)}</Fragment>)
  return out
}

function CodeBlock({ code, language }: { code: string; language: string }): ReactElement {
  // Synchronous tokens when the grammar is already loaded (the common path);
  // `null` means a grammar must load, which the effect awaits.
  const syncTokens = useMemo<readonly CodeToken[] | null>(() => {
    const result = getCodeTokens(code, language)
    return Array.isArray(result) ? result : null
  }, [code, language])
  const [asyncTokens, setAsyncTokens] = useState<readonly CodeToken[] | null>(null)
  useEffect(() => {
    if (syncTokens) return
    let active = true
    const result = getCodeTokens(code, language)
    if (!Array.isArray(result)) {
      void result.then((loaded) => {
        if (active) setAsyncTokens(loaded)
      })
    }
    return () => {
      active = false
    }
  }, [code, language, syncTokens])
  const tokens = syncTokens ?? asyncTokens ?? []
  return (
    <pre data-language={language || undefined}>
      <code>{tokens.length > 0 ? renderTokens(code, tokens) : code}</code>
    </pre>
  )
}

/** Wrap inline `children` in one mark, special-casing the view/link marks. */
function wrapMark(mark: Mark, children: ReactNode, context: RenderContext): ReactNode {
  const name = mark.type.name as MarkName
  switch (name) {
    case 'mdWikilink': {
      const attrs = mark.attrs as MdWikilinkAttrs
      return (
        <WikilinkChip
          target={attrs.target}
          display={attrs.display}
          onWikilinkClick={context.onWikilinkClick}
        >
          {children}
        </WikilinkChip>
      )
    }
    case 'mdImage': {
      const attrs = mark.attrs as MdImageAttrs
      return (
        <ImageView src={attrs.src} alt={attrs.alt} context={context}>
          {children}
        </ImageView>
      )
    }
    case 'mdLinkText': {
      const attrs = mark.attrs as MdLinkTextAttrs
      const handleClick = context.onLinkClick
        ? (event: MouseEvent) =>
            context.onLinkClick?.({ href: attrs.href, event: event.nativeEvent })
        : undefined
      return (
        <a className="md-link" href={attrs.href} onClick={handleClick}>
          {children}
        </a>
      )
    }
    default: {
      const toDOM = mark.type.spec.toDOM
      if (!toDOM) return children
      return outputSpecToReact(toDOM(mark, true), children)
    }
  }
}

interface InlineRun {
  text: string
  /** Marks in ProseMirror's canonical order (outermost first). */
  marks: readonly Mark[]
}

/**
 * Render a run of inline pieces, sharing a parent element across adjacent pieces
 * that have the same mark at `depth`. This mirrors ProseMirror's DOM
 * serialization, which keeps a mark element open across consecutive content (so
 * `**bold**` is one `<strong>` wrapping `**`, `bold`, `**`, not three).
 */
function renderRuns(
  runs: readonly InlineRun[],
  depth: number,
  context: RenderContext,
): ReactNode[] {
  const out: ReactNode[] = []
  let index = 0
  let key = 0
  while (index < runs.length) {
    const run = runs[index]
    if (run.marks.length <= depth) {
      out.push(<Fragment key={key++}>{run.text}</Fragment>)
      index++
      continue
    }
    const mark = run.marks[depth]
    let end = index + 1
    while (end < runs.length && runs[end].marks.length > depth && runs[end].marks[depth].eq(mark)) {
      end++
    }
    const inner = renderRuns(runs.slice(index, end), depth + 1, context)
    out.push(<Fragment key={key++}>{wrapMark(mark, inner, context)}</Fragment>)
    index = end
  }
  return out
}

function renderInline(node: ProseMirrorNode, context: RenderContext): ReactNode {
  const text = node.textContent
  if (!text) return null
  const chunks: readonly MarkChunk[] = inlineTextToMarkChunks(getMarkBuilders(), text)
  // Sort each chunk's marks into ProseMirror's canonical order so the grouping
  // and nesting match the editor.
  const runs = chunks.map(
    ([from, to, marks]): InlineRun => ({
      text: text.slice(from, to),
      marks: Mark.setFrom(marks),
    }),
  )
  return renderRuns(runs, 0, context)
}

function renderBlock(node: ProseMirrorNode, key: number, context: RenderContext): ReactNode {
  if (node.type.name === ('codeBlock' satisfies NodeName)) {
    const attrs = node.attrs as CodeBlockAttrs
    const language: string = typeof attrs.language === 'string' ? attrs.language : ''
    return <CodeBlock key={key} code={node.textContent} language={language} />
  }

  const toDOM = node.type.spec.toDOM
  if (node.isTextblock) {
    const inline = renderInline(node, context)
    return toDOM ? (
      outputSpecToReact(toDOM(node), inline, key)
    ) : (
      <Fragment key={key}>{inline}</Fragment>
    )
  }

  const children: ReactNode[] = []
  node.forEach((child, _offset, index) => {
    children.push(renderBlock(child, index, context))
  })
  return toDOM ? (
    outputSpecToReact(toDOM(node), children, key)
  ) : (
    <Fragment key={key}>{children}</Fragment>
  )
}

/**
 * Render Markdown to a read-only React tree that looks exactly like the editor
 * in `hide` mark mode: inline marks, wiki-link chips, images, tweet/YouTube
 * embeds, and syntax-highlighted code. No editor, no ProseMirror view; just a
 * walk over `markdownToDoc`'s document reusing meowdown's own parse, mark logic,
 * and CSS (the root carries `ProseMirror` + `data-mark-mode` so the existing
 * stylesheet applies). Requires a DOM environment.
 *
 * Callbacks (`onWikilinkClick`, etc.) should be stable; pass them via
 * `useCallback` to avoid re-rendering the whole tree.
 */
export function MarkdownView({
  markdown,
  markMode = 'hide',
  frontmatter = false,
  resolveImageUrl,
  onWikilinkClick,
  onLinkClick,
  onImageClick,
  className,
}: MarkdownViewProps): ReactElement {
  const content = useMemo(() => {
    const doc = markdownToDoc(markdown, { frontmatter })
    const context: RenderContext = { resolveImageUrl, onWikilinkClick, onLinkClick, onImageClick }
    const blocks: ReactNode[] = []
    doc.forEach((node, _offset, index) => {
      blocks.push(renderBlock(node, index, context))
    })
    return blocks
  }, [markdown, frontmatter, resolveImageUrl, onWikilinkClick, onLinkClick, onImageClick])

  return (
    <div className={clsx('ProseMirror', 'meowdown-content', className)} data-mark-mode={markMode}>
      {content}
    </div>
  )
}
