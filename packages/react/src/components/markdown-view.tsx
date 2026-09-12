import {
  collectReferenceDefinitions,
  defaultResolveImageUrl,
  defaultResolveXPost,
  formatFileSize,
  getCodeTokens,
  getFileKind,
  getMarkBuilders,
  inlineTextToMarkChunksWithContext,
  isModEvent,
  isNodeOfType,
  isReferenceDefinitionNode,
  markdownToDoc,
  matchEmbed,
  parseXPostId,
  type CodeBlockAttrs,
  type CodeToken,
  type EmbedDescriptor,
  type FileClickHandler,
  type FileInfoResolver,
  type FileLinkResolver,
  type ImageClickHandler,
  type LinkClickHandler,
  type ListMarker,
  type MarkChunk,
  type MarkMode,
  type MarkName,
  type MdFileAttrs,
  type MdImageAttrs,
  type MdLinkTextAttrs,
  type MdMathAttrs,
  type MdWikilinkAttrs,
  type MeowdownListAttrs,
  type NodeName,
  type XPostResolver,
  type ReferenceDefinitions,
  type WikiEmbedResolver,
  type WikilinkClickHandler,
  type WikilinkResolver,
} from '@meowdown/core'
import { registerXPost } from '@post-embed/elements/x'
import type { Tweet } from '@post-embed/types'
import type { DOMOutputSpec } from '@prosekit/pm/model'
import { Mark, type Node as ProseMirrorNode } from '@prosekit/pm/model'
import { clsx } from 'clsx/lite'
import {
  cloneElement,
  createElement,
  Fragment,
  memo,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react'

import { useBeautifulMermaid } from '../hooks/use-beautiful-mermaid.ts'
import { useKaTeX } from '../hooks/use-katex.ts'

import { attributesToProps } from './attributes-to-props.ts'
import styles from './code-block-view.module.css'
import { normalizeDOMOutputSpec, type TypedDOMOutputSpec } from './dom-output-spec.tsx'
import { MathRender } from './math-render.tsx'
import { MermaidRender } from './mermaid-render.tsx'

/**
 * Payload for {@link TaskClickHandler}.
 */
export interface TaskClickPayload {
  /**
   * Zero-based position of the clicked checkbox among all the checkboxes this
   * view renders, in document order. Stable for a given `markdown`, so a host
   * can map it back to the corresponding task item in its own parse of the
   * same source.
   */
  index: number
  /**
   * The checkbox's rendered state. The view never flips it — see the handler doc.
   */
  checked: boolean
  /**
   * The item's list marker as written (`+` renders a circle checkbox, `-`/`*` a square).
   */
  marker: ListMarker
  /**
   * First line of the item's own inline content, exactly as it appears in the
   * source after the `[ ]`/`[x]` marker and one space. A host locating the task
   * by {@link index} can cross-check this against its own parse and refuse a
   * mismatch instead of toggling the wrong item.
   */
  text: string
  /**
   * The originating click. Read modifier keys or position a popover from it.
   */
  event: globalThis.MouseEvent
}

/**
 * Called when a rendered task checkbox is clicked. The view is a pure render
 * of `markdown` and never flips the box itself: apply the toggle to the
 * source and re-render, exactly like the other click handlers.
 */
export type TaskClickHandler = (payload: TaskClickPayload) => void

export interface MarkdownViewProps {
  /**
   * The Markdown to render. Live: changing it re-renders the content.
   */
  markdown: string
  /**
   * Mark mode for the read-only view. Defaults to `'hide'`.
   */
  markMode?: MarkMode
  /**
   * Peel a leading YAML frontmatter block before rendering. Off by default.
   */
  frontmatter?: boolean
  /**
   * Whether rendered links, images, file pills, and task checkboxes can be activated.
   * Defaults to `true`. When `false`, callbacks are ignored, the rendered tree
   * contains no anchors or focusable task controls, and recognized tweet and
   * YouTube embeds are omitted before any image resolver runs.
   */
  interactive?: boolean
  /**
   * Render collapsed (`+`) bullets expanded, ignoring their fold state at any
   * depth. Off by default. For views that show slices of a note (e.g. a
   * backlinks panel), where the source's fold state must not hide the content
   * the view exists to show.
   */
  expandCollapsed?: boolean
  /**
   * Map an image `src` to a displayable URL, or `undefined` to skip it.
   */
  resolveImageUrl?: (src: string) => string | undefined
  /**
   * Claim a `[label](url)` link as a file pill instead of a regular link.
   * Must be pure; return `false` for links that should render normally.
   */
  resolveFileLink?: FileLinkResolver
  /**
   * Classify `![[target]]` as an image, file, or note; unresolved source stays literal.
   */
  resolveWikiEmbed?: WikiEmbedResolver
  /**
   * Resolve a `[[...]]` wikilink into its target and chip label; the bracketed
   * text is both by default. Must be pure.
   */
  resolveWikilink?: WikilinkResolver
  /**
   * Resolve metadata shown on a file pill.
   */
  resolveFileInfo?: FileInfoResolver
  /**
   * Resolve the data behind an X post URL, rendered as a `post-embed-x-post`
   * card. Defaults to `defaultResolveXPost`.
   */
  resolveXPost?: XPostResolver
  /**
   * Called when a rendered wikilink is clicked. Pass a stable function.
   */
  onWikilinkClick?: WikilinkClickHandler
  /**
   * Called when a rendered Markdown link is clicked. Pass a stable function.
   */
  onLinkClick?: LinkClickHandler
  /**
   * Called when a rendered image is clicked. Pass a stable function.
   */
  onImageClick?: ImageClickHandler
  /**
   * Called when a rendered file pill is clicked. Pass a stable function.
   */
  onFileClick?: FileClickHandler
  /**
   * Called when a rendered task checkbox is clicked. Pass a stable function.
   */
  onTaskClick?: TaskClickHandler
  /**
   * Extra class on the content root (alongside `ProseMirror meowdown-content`).
   */
  className?: string
}

/**
 * The props every block renders with. One object per set of props, so a
 * block's `memo` comparator can test it by identity.
 */
interface BlockContext {
  interactive: boolean
  expandCollapsed: boolean
  resolveImageUrl?: (src: string) => string | undefined
  resolveFileLink?: FileLinkResolver
  resolveWikiEmbed?: WikiEmbedResolver
  resolveWikilink?: WikilinkResolver
  resolveFileInfo?: FileInfoResolver
  resolveXPost?: XPostResolver
  onWikilinkClick?: WikilinkClickHandler
  onLinkClick?: LinkClickHandler
  onImageClick?: ImageClickHandler
  onFileClick?: FileClickHandler
  onTaskClick?: TaskClickHandler
}

interface RenderContext extends BlockContext {
  referenceDefinitions: ReferenceDefinitions
  /**
   * Document-order checkbox counter feeding {@link TaskClickPayload.index}.
   * Starts at the block's `taskBase` so the index stays document-wide.
   */
  taskCounter: { value: number }
  /**
   * Per-block element key counter. Keys only need to be unique among siblings.
   */
  keyCounter: { value: number }
}

/**
 * Convert a ProseMirror `DOMOutputSpec` into a React node, substituting `content`
 * for the spec's content hole (`0`). Reused for every node/mark spec the static
 * walker does not special-case, so blocks and plain marks render off their real
 * `toDOM`, exactly as the editor serializes them.
 */
function outputSpecToReact(
  spec: DOMOutputSpec | 0 | string,
  content: ReactNode,
  context: RenderContext,
): ReactElement | string | null {
  const key = context.keyCounter.value++

  if (typeof spec === 'string') return spec
  if (spec === 0) return <Fragment key={key}>{content}</Fragment>

  const normalized = normalizeDOMOutputSpec(spec as TypedDOMOutputSpec)
  if (!normalized) return null

  const [tag, attrs, rest] = normalized
  const reactProps = { ...attributesToProps(attrs, tag) }
  reactProps.key = `${key} ${JSON.stringify(attrs)}`

  if (tag === 'input' && attrs?.['type'] === 'checkbox') {
    reactProps.readOnly = true
    if (!context.interactive) {
      reactProps.disabled = true
      reactProps.tabIndex = -1
    }
  }

  const reactChildren = rest.map((child) => outputSpecToReact(child, content, context))
  return createElement(tag, reactProps, ...reactChildren)
}

function WikilinkChip(props: {
  target: string
  display: string
  onWikilinkClick?: WikilinkClickHandler
  children: ReactNode
}): ReactElement {
  const { target, display, onWikilinkClick, children } = props
  const handleClick = onWikilinkClick
    ? (event: MouseEvent) => {
        return onWikilinkClick({
          target,
          event: event.nativeEvent,
          mod: isModEvent(event),
        })
      }
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

function EmbedFrame(props: { embed: EmbedDescriptor; width: number | null }): ReactElement {
  const { embed, width } = props
  // A persisted width narrows the player; the `aspect-ratio` CSS on
  // `.md-embed-youtube` derives the height.
  return (
    <span className="md-image-view-preview md-atom-view-preview" contentEditable={false}>
      <iframe
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
        style={width == null ? undefined : { width }}
      />
    </span>
  )
}

type XPostState = { tweet: Tweet | undefined } | { pending: Promise<Tweet | undefined> }

function XPostEmbed(props: { src: string; resolveXPost: XPostResolver }): ReactElement {
  const { src, resolveXPost } = props
  // The initializer runs during the first render, so a synchronous answer is
  // in the first frame; `key={src}` at the call site remounts on a new URL.
  const [state, setState] = useState<XPostState>(() => {
    try {
      const result = resolveXPost(src)
      if (result instanceof Promise) return { pending: result }
      registerXPost()
      return { tweet: result }
    } catch (error) {
      console.error('[meowdown] resolveXPost failed:', error)
      registerXPost()
      return { tweet: undefined }
    }
  })
  useEffect(() => {
    if (!('pending' in state)) return
    let cancelled = false
    void state.pending.then(
      (tweet) => {
        if (cancelled) return
        registerXPost()
        setState({ tweet })
      },
      (error: unknown) => {
        console.error('[meowdown] resolveXPost failed:', error)
        if (cancelled) return
        registerXPost()
        setState({ tweet: undefined })
      },
    )
    return () => {
      cancelled = true
    }
  }, [state])
  if ('pending' in state) {
    return (
      <span
        className="md-image-view-preview md-atom-view-preview"
        contentEditable={false}
        data-testid="x-post-embed"
        data-pending=""
      />
    )
  }
  return (
    <span
      className="md-image-view-preview md-atom-view-preview"
      contentEditable={false}
      data-testid="x-post-embed"
    >
      {createElement('post-embed-x-post', { data: state.tweet ?? null })}
    </span>
  )
}

function ImagePreview(props: {
  src: string
  alt: string
  width: number | null
  resolveImageUrl?: (src: string) => string | undefined
  resolveXPost?: XPostResolver
  onImageClick?: ImageClickHandler
  interactive: boolean
}): ReactElement | null {
  const { src, alt, width, resolveImageUrl, resolveXPost, onImageClick, interactive } = props
  if (parseXPostId(src) !== undefined) {
    if (!interactive) return null
    return <XPostEmbed key={src} src={src} resolveXPost={resolveXPost ?? defaultResolveXPost} />
  }
  const embed = matchEmbed(src)
  if (embed) return interactive ? <EmbedFrame embed={embed} width={width} /> : null
  const url = (resolveImageUrl ?? defaultResolveImageUrl)(src)
  if (!url) return null
  const handleClick = onImageClick
    ? (event: MouseEvent) => {
        return onImageClick({
          src,
          alt,
          event: event.nativeEvent,
          mod: isModEvent(event),
        })
      }
    : undefined
  return (
    <span
      className="md-image-view-preview md-atom-view-preview"
      data-testid="image-preview"
      contentEditable={false}
    >
      <img
        src={url}
        alt={alt}
        draggable={false}
        onClick={handleClick}
        style={width == null ? undefined : { width: `${width}px` }}
      />
    </span>
  )
}

function ImageView(props: {
  src: string
  alt: string
  width: number | null
  context: RenderContext
  children: ReactNode
}): ReactElement {
  const { src, alt, width, context, children } = props
  return (
    <span className="md-image-view md-atom-view">
      <ImagePreview
        src={src}
        alt={alt}
        width={width}
        resolveImageUrl={context.resolveImageUrl}
        resolveXPost={context.resolveXPost}
        onImageClick={context.onImageClick}
        interactive={context.interactive}
      />
      <span className="md-image-view-content md-atom-view-content">{children}</span>
    </span>
  )
}

function FileView(props: {
  href: string
  name: string
  context: RenderContext
  children: ReactNode
}): ReactElement {
  const { href, name, context, children } = props
  const resolveFileInfo = context.resolveFileInfo
  const [resolvedSize, setResolvedSize] = useState<{
    href: string
    resolver: FileInfoResolver
    text: string
  }>()
  useEffect(() => {
    if (!resolveFileInfo) return
    let active = true
    const load = async (): Promise<void> => {
      try {
        const info = await resolveFileInfo(href)
        if (!active || info?.size == null || !Number.isFinite(info.size) || info.size < 0) return
        setResolvedSize({ href, resolver: resolveFileInfo, text: formatFileSize(info.size) })
      } catch (error) {
        console.error('[meowdown] resolveFileInfo failed:', error)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [resolveFileInfo, href])

  const size =
    resolvedSize?.href === href && resolvedSize.resolver === resolveFileInfo
      ? resolvedSize.text
      : ''

  const handleClick = context.onFileClick
    ? (event: MouseEvent) => {
        context.onFileClick?.({
          href,
          name,
          event: event.nativeEvent,
          mod: isModEvent(event),
        })
      }
    : undefined
  return (
    <span className="md-file-view md-atom-view">
      <span
        className="md-file-view-preview md-atom-view-preview"
        data-testid="file-pill"
        data-file-kind={getFileKind(href)}
        contentEditable={false}
        title={name}
        onClick={handleClick}
      >
        <svg
          className="md-file-view-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        </svg>
        <span className="md-file-view-name">{name}</span>
        <span className="md-file-view-size" data-testid="file-pill-size">
          {size}
        </span>
      </span>
      <span className="md-file-view-content md-atom-view-content">{children}</span>
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

/**
 * Mirrors the editor's `MathMarkView` DOM: a KaTeX preview next to the source
 * text, flipped by the same mode CSS (the read-only view has no caret, so the
 * preview always shows in hide/focus modes).
 */
function MathView(props: { formula: string; children: ReactNode }): ReactElement {
  const { formula, children } = props
  const katex = useKaTeX(true)
  if (!katex) return <span>{formula}</span>
  return (
    <span className="md-math-view">
      <MathRender
        katex={katex}
        formula={formula}
        displayMode={false}
        className="md-math-view-preview"
        data-testid="math-preview"
      />
      <span className="md-math-view-content">{children}</span>
    </span>
  )
}

/**
 * A `math` code block: the rendered formula alone, the source while KaTeX loads.
 */
function MathCodeBlock({ code }: { code: string }): ReactElement {
  const katex = useKaTeX(true)
  if (!katex) return <CodeBlock code={code} language="math" />
  return (
    <MathRender
      katex={katex}
      formula={code}
      displayMode
      className={styles.Preview}
      data-testid="code-block-math-preview"
    />
  )
}

function MermaidCodeBlock({ code }: { code: string }): ReactElement {
  const renderer = useBeautifulMermaid(true)
  if (!renderer || code.trim() === '') return <CodeBlock code={code} language="mermaid" />
  return (
    <MermaidRender
      renderer={renderer}
      source={code}
      className={`${styles.Preview} ${styles.MermaidPreview}`}
      data-testid="code-block-mermaid-preview"
    />
  )
}

/**
 * Wrap inline `children` in one mark, special-casing the view/link marks.
 */
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
        <ImageView src={attrs.src} alt={attrs.alt} width={attrs.width} context={context}>
          {children}
        </ImageView>
      )
    }
    case 'mdFile': {
      const attrs = mark.attrs as MdFileAttrs
      return (
        <FileView href={attrs.href} name={attrs.name} context={context}>
          {children}
        </FileView>
      )
    }
    case 'mdMath': {
      const attrs = mark.attrs as MdMathAttrs
      return <MathView formula={attrs.formula}>{children}</MathView>
    }
    case 'mdLinkText': {
      const attrs = mark.attrs as MdLinkTextAttrs
      if (!context.interactive) return <span className="md-link">{children}</span>
      const handleClick = context.onLinkClick
        ? (event: MouseEvent) => {
            event.preventDefault()
            context.onLinkClick?.({
              href: attrs.href,
              event: event.nativeEvent,
              mod: isModEvent(event),
            })
          }
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
      return outputSpecToReact(toDOM(mark, true), children, context)
    }
  }
}

interface InlineRun {
  text: string
  /**
   * Marks in ProseMirror's canonical order (outermost first).
   */
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
  const chunks: readonly MarkChunk[] = inlineTextToMarkChunksWithContext(
    getMarkBuilders(),
    text,
    {
      resolveFileLink: context.resolveFileLink,
      resolveWikiEmbed: context.resolveWikiEmbed,
      resolveWikilink: context.resolveWikilink,
    },
    { referenceDefinitions: context.referenceDefinitions },
  )
  // Sort each chunk's marks into ProseMirror's canonical order so the grouping
  // and nesting match the editor.
  const runs = chunks.map(([from, to, marks]): InlineRun => ({
    text: text.slice(from, to),
    marks: Mark.setFrom(marks),
  }))
  return renderRuns(runs, 0, context)
}

/**
 * A collapsed list renders as an expanded one
 */
function expandCollapsedList(node: ProseMirrorNode): ProseMirrorNode {
  const attrs = node.attrs as MeowdownListAttrs
  if (!attrs.collapsed) return node
  return node.type.create({ ...attrs, collapsed: false }, node.content, node.marks)
}

function createTaskClickHandler(
  node: ProseMirrorNode,
  context: RenderContext,
): ((event: MouseEvent) => void) | undefined {
  const attrs = node.attrs as MeowdownListAttrs
  const { onTaskClick } = context
  if (attrs.kind !== 'task' || !onTaskClick) return undefined

  const index = context.taskCounter.value++
  const checked = attrs.checked === true
  const marker = attrs.marker ?? null
  // TODO: the rule to get the text is a bit weird. Re-visit this later.
  const text = node.firstChild?.isTextblock
    ? (node.firstChild.textContent.split('\n', 1)[0] ?? '')
    : ''
  return (event) => {
    event.preventDefault()
    onTaskClick({ index, checked, marker, text, event: event.nativeEvent })
  }
}

function renderCodeBlock(node: ProseMirrorNode, key: number): ReactNode {
  const attrs = node.attrs as CodeBlockAttrs
  const language: string = typeof attrs.language === 'string' ? attrs.language : ''
  if (language === 'math') {
    return <MathCodeBlock key={key} code={node.textContent} />
  }
  if (language === 'mermaid') {
    return <MermaidCodeBlock key={key} code={node.textContent} />
  }
  return <CodeBlock key={key} code={node.textContent} language={language} />
}

function renderBlock(
  node: ProseMirrorNode,
  context: RenderContext,
  parent: ProseMirrorNode | null,
  index: number,
): ReactNode {
  if (isReferenceDefinitionNode(node, parent, index)) return null

  const key = context.keyCounter.value++
  const typeName = node.type.name as NodeName

  let handleTaskClick: ((event: MouseEvent) => void) | undefined

  if (typeName === 'list') {
    if (context.expandCollapsed) {
      node = expandCollapsedList(node)
    }
    handleTaskClick = createTaskClickHandler(node, context)
  }

  if (typeName === 'codeBlock') {
    return renderCodeBlock(node, key)
  }

  const toDOM = node.type.spec.toDOM
  if (node.isTextblock) {
    const inline = renderInline(node, context)
    return toDOM ? (
      outputSpecToReact(toDOM(node), inline, context)
    ) : (
      <Fragment key={key}>{inline}</Fragment>
    )
  }

  const children: ReactNode[] = node.content.content.map((child, childIndex) => {
    return renderBlock(child, context, node, childIndex)
  })

  const reactNode = toDOM ? (
    outputSpecToReact(toDOM(node), children, context)
  ) : (
    <Fragment key={key}>{children}</Fragment>
  )

  if (
    typeName === 'list' &&
    handleTaskClick &&
    typeof reactNode !== 'string' &&
    reactNode != null
  ) {
    // eslint-disable-next-line @eslint-react/no-clone-element
    return cloneElement(reactNode, { onClick: handleTaskClick })
  }

  return reactNode
}

function isTaskList(node: ProseMirrorNode): boolean {
  return isNodeOfType(node, 'list') && (node.attrs as MeowdownListAttrs).kind === 'task'
}

/**
 * Checkboxes a block renders, in the same pre-order `renderBlock` walks, so a
 * block's first checkbox index is the sum over the blocks before it.
 */
function countTaskItems(node: ProseMirrorNode): number {
  let count = isTaskList(node) ? 1 : 0
  node.descendants((child) => {
    if (isTaskList(child)) count++
    return true
  })
  return count
}

/**
 * The effective definitions as one string, so blocks can compare them by
 * content: `collectReferenceDefinitions` builds a new map on every parse.
 */
function definitionsSignature(definitions: ReferenceDefinitions): string {
  let signature = ''
  for (const { key, href, title } of definitions.values()) {
    signature += `${key}\0${href}\0${title}\n`
  }
  return signature
}

interface Block {
  node: ProseMirrorNode
  /**
   * Checkboxes rendered by the blocks before this one.
   */
  taskBase: number
}

function splitBlocks(doc: ProseMirrorNode): Block[] {
  const blocks: Block[] = []
  let taskBase = 0
  for (const node of doc.content.content) {
    blocks.push({ node, taskBase })
    taskBase += countTaskItems(node)
  }
  return blocks
}

interface MarkdownBlockProps {
  node: ProseMirrorNode
  taskBase: number
  context: BlockContext
  referenceDefinitions: ReferenceDefinitions
  definitionsKey: string
}

/**
 * One top-level block. Memoized on the block's own content (`Node.eq`), its
 * first checkbox index, the shared props object, and the definitions'
 * content, so a growing document re-renders only the block that changed.
 */
const MarkdownBlock = memo(
  function MarkdownBlock({
    node,
    taskBase,
    context,
    referenceDefinitions,
  }: MarkdownBlockProps): ReactNode {
    const renderContext: RenderContext = {
      ...context,
      referenceDefinitions,
      taskCounter: { value: taskBase },
      keyCounter: { value: 0 },
    }
    return renderBlock(node, renderContext, null, 0)
  },
  (previous, next) => {
    return (
      previous.taskBase === next.taskBase &&
      previous.context === next.context &&
      previous.definitionsKey === next.definitionsKey &&
      (previous.node === next.node || previous.node.eq(next.node))
    )
  },
)

/**
 * Render Markdown to a read-only React tree that looks exactly like the editor
 * in `hide` mark mode: inline marks, wikilink chips, images, tweet/YouTube
 * embeds, and syntax-highlighted code. No editor, no ProseMirror view; just a
 * walk over `markdownToDoc`'s document reusing meowdown's own parse, mark logic,
 * and CSS (the root carries `ProseMirror` + `data-mark-mode` so the existing
 * stylesheet applies). Requires a DOM environment.
 *
 * Callbacks (`onWikilinkClick`, etc.) and resolvers should be stable; pass them via
 * `useCallback` to avoid re-rendering the whole tree.
 */
export function MarkdownView({
  markdown,
  markMode = 'hide',
  frontmatter = false,
  interactive = true,
  expandCollapsed = false,
  resolveImageUrl,
  resolveFileLink,
  resolveWikiEmbed,
  resolveWikilink,
  resolveFileInfo,
  resolveXPost,
  onWikilinkClick,
  onLinkClick,
  onImageClick,
  onFileClick,
  onTaskClick,
  className,
}: MarkdownViewProps): ReactElement {
  const context = useMemo<BlockContext>(
    () => ({
      interactive,
      expandCollapsed,
      resolveImageUrl,
      resolveFileLink,
      resolveWikiEmbed,
      resolveWikilink,
      resolveFileInfo,
      resolveXPost,
      onWikilinkClick: interactive ? onWikilinkClick : undefined,
      onLinkClick: interactive ? onLinkClick : undefined,
      onImageClick: interactive ? onImageClick : undefined,
      onFileClick: interactive ? onFileClick : undefined,
      onTaskClick: interactive ? onTaskClick : undefined,
    }),
    [
      interactive,
      expandCollapsed,
      resolveImageUrl,
      resolveFileLink,
      resolveWikiEmbed,
      resolveWikilink,
      resolveFileInfo,
      resolveXPost,
      onWikilinkClick,
      onLinkClick,
      onImageClick,
      onFileClick,
      onTaskClick,
    ],
  )

  const { blocks, referenceDefinitions, definitionsKey } = useMemo(() => {
    const doc = markdownToDoc(markdown, { frontmatter })
    const referenceDefinitions = collectReferenceDefinitions(doc).definitions
    return {
      blocks: splitBlocks(doc),
      referenceDefinitions,
      definitionsKey: definitionsSignature(referenceDefinitions),
    }
  }, [markdown, frontmatter])

  return (
    <div className={clsx('ProseMirror', 'meowdown-content', className)} data-mark-mode={markMode}>
      {blocks.map(({ node, taskBase }, index) => (
        <MarkdownBlock
          key={index}
          node={node}
          taskBase={taskBase}
          context={context}
          referenceDefinitions={referenceDefinitions}
          definitionsKey={definitionsKey}
        />
      ))}
    </div>
  )
}
