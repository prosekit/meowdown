import { defineMarkView, type PlainExtension } from '@prosekit/core'
import type { Mark } from '@prosekit/pm/model'
import type { EditorView, MarkView, ViewMutationRecord } from '@prosekit/pm/view'
import {
  registerResizableHandleElement,
  registerResizableRootElement,
  type ResizeEndEvent,
} from '@prosekit/web/resizable'

import { listenForTweetHeight, matchEmbed, type EmbedDescriptor } from './embed.ts'
import { getMarkRangeAt } from './get-mark-range-at.ts'
import type { MdImageAttrs } from './inline-marks.ts'
import {
  formatMagicComment,
  parseMagicComment,
  stripMagicComment,
  type MagicComment,
} from './magic-comment.ts'
import type { MarkName } from './mark-names.ts'
import { formatSizedWikiEmbed, parseWikiEmbed } from './wiki-embed.ts'

type ImageUrlResolver = (src: string) => string | undefined

/** Options for {@link defineImage}. */
export interface ImageOptions {
  /**
   * Map a markdown `src` to a displayable URL, or `undefined` to skip rendering
   * that image. Defaults to `defaultResolveImageUrl`.
   */
  resolveImageUrl?: ImageUrlResolver
  /**
   * Whether to write the height a tweet embed reports back into the trailing
   * size comment, so the next load can seed the iframe at its final height.
   * Defaults to `true`; disable when the document must never change without a
   * user edit (e.g. deterministic tests).
   */
  persistTweetHeight?: boolean
}

/** Show an `src` as-is when it is an http(s) URL, otherwise skip rendering it. */
export function defaultResolveImageUrl(src: string): string | undefined {
  return /^https?:\/\//i.test(src) ? src : undefined
}

/**
 * Default cap on an image's displayed height in CSS pixels.
 */
const MAX_DISPLAY_HEIGHT = 500

/**
 * Size a tweet iframe: the persisted or reported height, or neither yet
 * (`null`), which restores the unknown-height placeholder.
 */
function applyTweetHeight(iframe: HTMLIFrameElement, height: number | null): void {
  if (height == null) {
    iframe.style.removeProperty('height')
    delete iframe.dataset.sized
    return
  }
  iframe.style.height = `${height}px`
  iframe.dataset.sized = ''
}

/**
 * Build the iframe DOM for an embed descriptor and start its height listener.
 * A persisted tweet height seeds the iframe before `Tweet.html` reports the
 * real one, so a revisited tweet keeps its space instead of shifting layout.
 */
function buildEmbedIframe(
  embed: EmbedDescriptor,
  height: number | null,
  onHeight: (height: number) => void,
): HTMLIFrameElement {
  const iframe = document.createElement('iframe')
  iframe.src = embed.src
  iframe.title = embed.title
  iframe.className = embed.className
  iframe.dataset.testid = embed.testid
  iframe.loading = 'lazy'
  iframe.referrerPolicy = 'strict-origin-when-cross-origin'
  iframe.setAttribute('frameborder', '0')
  if (embed.allow) iframe.allow = embed.allow
  if (embed.allowFullscreen) iframe.allowFullscreen = true
  if (embed.kind === 'tweet') {
    if (height != null) applyTweetHeight(iframe, height)
    listenForTweetHeight(iframe, onHeight)
  }
  return iframe
}

/**
 * Write a persisted display size onto a resizable resizable root.
 */
function applySize(root: HTMLElement, width: number | null, height: number | null): void {
  if (width != null) root.setAttribute('data-width', String(Math.ceil(width)))
  if (height != null) root.setAttribute('data-height', String(Math.ceil(height)))
}

/**
 * Write the display size onto the resizable root. Persisted dimensions win;
 * missing ones derive from the image's natural size (capping the height at
 * MAX_DISPLAY_HEIGHT, never upscaling). Before the image has loaded, only the
 * persisted dimensions are seeded; the load listener fills in the rest.
 */
function applyImageDisplaySize(
  root: HTMLElement,
  image: HTMLImageElement,
  width: number | null,
  height: number | null,
): void {
  if (width != null && height != null) {
    applySize(root, width, height)
    return
  }
  const ratio = image.naturalWidth / image.naturalHeight
  if (!Number.isFinite(ratio) || ratio <= 0) {
    applySize(root, width, height)
    return
  }
  const displayHeight =
    width == null ? Math.min(image.naturalHeight, MAX_DISPLAY_HEIGHT) : width / ratio
  const displayWidth = width ?? displayHeight * ratio
  applySize(root, displayWidth, displayHeight)
}

/**
 * Rewrite only the trailing magic comment of the image source at `range`,
 * merging `patch` into the existing metadata and leaving the `![alt](url)`
 * source untouched. The inline-mark plugin re-derives the `width`/`height`
 * attributes from the new text.
 */
function rewriteMagicComment(
  view: EditorView,
  range: { from: number; to: number },
  patch: MagicComment,
  addToHistory: boolean,
): void {
  const current = view.state.doc.textBetween(range.from, range.to)

  // Split the range into the `![alt](url)` source and its optional comment;
  // positions in a textblock are 1:1 with characters, so `from + base.length` is
  // exactly where the source ends and the comment begins.
  const base = stripMagicComment(current)
  const commentFrom = range.from + base.length
  const currentComment = current.slice(base.length)

  const nextComment = formatMagicComment({
    ...parseMagicComment(currentComment),
    ...patch,
  })
  if (nextComment === currentComment) return

  const transaction = view.state.tr.insertText(nextComment, commentFrom, range.to)
  if (!addToHistory) transaction.setMeta('addToHistory', false)
  view.dispatch(transaction)
}

/** Persist a resized width and height into the trailing magic comment. */
function commitImageSize(
  view: EditorView,
  content: HTMLElement,
  rawWidth: number,
  rawHeight: number,
): void {
  const pos = view.posAtDOM(content, 0)
  const range = getMarkRangeAt(view.state, pos, 'mdImage')
  if (!range) return
  const attrs = range.mark.attrs as MdImageAttrs

  if (attrs.syntax === 'wikiEmbed') {
    const current = view.state.doc.textBetween(range.from, range.to)
    const target = attrs.wikiTarget || parseWikiEmbed(current).target
    if (!target) return
    const next = formatSizedWikiEmbed(target, rawWidth, rawHeight)
    if (next !== current) view.dispatch(view.state.tr.insertText(next, range.from, range.to))
    return
  }

  rewriteMagicComment(
    view,
    range,
    { width: Math.round(rawWidth), height: Math.round(rawHeight) },
    true,
  )
}

/**
 * Ignore reported tweet heights this close to the persisted one. Fonts, theme,
 * and container width nudge the rendered height by a few pixels per device;
 * writing those back would churn the document on every open.
 */
const TWEET_HEIGHT_TOLERANCE = 8

/**
 * Persist the height a tweet embed reported, so the next load can seed the
 * iframe before the tweet renders. A passive metadata write: outside undo
 * history, skipped in read-only views, and skipped inside the tolerance.
 */
function commitTweetHeight(view: EditorView, content: HTMLElement, height: number): void {
  if (!view.editable || !content.isConnected) return
  const pos = view.posAtDOM(content, 0)
  const range = getMarkRangeAt(view.state, pos, 'mdImage')
  if (!range) return
  const attrs = range.mark.attrs as MdImageAttrs
  if (attrs.height != null && Math.abs(height - attrs.height) <= TWEET_HEIGHT_TOLERANCE) return
  rewriteMagicComment(view, range, { height: Math.round(height) }, false)
}

class ImageMarkView implements MarkView {
  readonly #dom: HTMLElement
  readonly #contentDOM: HTMLElement
  readonly #view: EditorView
  readonly #resolveImageUrl: ImageUrlResolver | undefined
  readonly #persistTweetHeight: boolean
  #attrs: MdImageAttrs
  #resizableRoot: HTMLElement | undefined
  #image: HTMLImageElement | undefined
  #tweetIframe: HTMLIFrameElement | undefined

  constructor(mark: Mark, view: EditorView, options: ImageOptions) {
    this.#attrs = mark.attrs as MdImageAttrs
    this.#view = view
    this.#resolveImageUrl = options.resolveImageUrl
    this.#persistTweetHeight = options.persistTweetHeight ?? true

    this.#dom = document.createElement('span')
    this.#dom.className = 'md-image-view md-atom-view'

    this.#contentDOM = document.createElement('span')
    this.#contentDOM.className = 'md-image-view-content md-atom-view-content'

    const preview = this.#renderPreview()
    if (preview) {
      preview.contentEditable = 'false'
      this.#dom.appendChild(preview)
    }

    this.#dom.appendChild(this.#contentDOM)
  }

  get dom(): HTMLElement {
    return this.#dom
  }

  get contentDOM(): HTMLElement {
    return this.#contentDOM
  }

  update(mark: Mark): boolean {
    const next = mark.attrs as MdImageAttrs
    const previous = this.#attrs
    // False rebuilds the view from the constructor; a new src can change the preview shape.
    if (next.src !== previous.src) return false
    this.#attrs = next
    if (this.#image && next.alt !== previous.alt) {
      this.#image.alt = next.alt
    }
    if (this.#resizableRoot && (next.width !== previous.width || next.height !== previous.height)) {
      if (this.#image) {
        applyImageDisplaySize(this.#resizableRoot, this.#image, next.width, next.height)
      } else {
        applySize(this.#resizableRoot, next.width, next.height)
      }
    }
    if (this.#tweetIframe && next.height !== previous.height) {
      applyTweetHeight(this.#tweetIframe, next.height)
    }
    return true
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return !this.#contentDOM.contains(mutation.target)
  }

  /** Build the inline preview for the image `src`: an embed iframe or a resizable `<img>`. */
  #renderPreview(): HTMLElement | undefined {
    const { src } = this.#attrs
    const embed = matchEmbed(src)
    if (embed) {
      const wrapper = document.createElement('span')
      wrapper.className = 'md-image-view-preview md-atom-view-preview'
      const onHeight = (height: number) => {
        applyTweetHeight(iframe, height)
        if (this.#persistTweetHeight) {
          commitTweetHeight(this.#view, this.#contentDOM, height)
        }
      }
      const iframe = buildEmbedIframe(embed, this.#attrs.height, onHeight)
      if (embed.kind === 'tweet') this.#tweetIframe = iframe
      wrapper.appendChild(embed.kind === 'youtube' ? this.#buildResizableEmbed(iframe) : iframe)
      return wrapper
    }

    const url = (this.#resolveImageUrl ?? defaultResolveImageUrl)(src)
    if (!url) return undefined

    const wrapper = document.createElement('span')
    wrapper.className = 'md-image-view-preview md-atom-view-preview'
    wrapper.dataset.testid = 'image-preview'
    wrapper.appendChild(this.#buildResizableImage(url))
    return wrapper
  }

  /**
   * A resizable YouTube embed: the same resizable web component as images, with
   * the player's fixed 16:9 ratio, so a drag only ever picks a width. Releasing
   * a drag writes the size into the markdown source as a
   * `<!-- {"width":N,"height":M} -->` comment, exactly like an image.
   */
  #buildResizableEmbed(iframe: HTMLIFrameElement): HTMLElement {
    registerResizableRootElement()
    registerResizableHandleElement()

    const root = document.createElement('prosekit-resizable-root')
    root.className = 'md-embed-resizable'
    root.dataset.testid = 'embed-resizable'
    root.setAttribute('data-aspect-ratio', String(16 / 9))
    applySize(root, this.#attrs.width, this.#attrs.height)
    root.appendChild(iframe)

    const handle = document.createElement('prosekit-resizable-handle')
    handle.className = 'md-image-resize-handle'
    handle.setAttribute('position', 'bottom-right')
    // A click (no drag) on the handle must not bubble to the image-click handler.
    handle.addEventListener('click', (event) => event.stopPropagation())
    root.appendChild(handle)

    root.addEventListener('resizeEnd', (event) => {
      const { width: nextWidth, height: nextHeight } = (event as ResizeEndEvent).detail
      commitImageSize(this.#view, this.#contentDOM, nextWidth, nextHeight)
    })

    this.#resizableRoot = root
    return root
  }

  /**
   * A resizable `<img>`: ProseKit's resizable web component wrapping the image,
   * plus a drag handle. Releasing a drag writes the new width and height into
   * the markdown source as a `<!-- {"width":N,"height":M} -->` comment, which
   * the inline-mark plugin re-derives back into the mark's `width`/`height`
   * attributes.
   */
  #buildResizableImage(url: string): HTMLElement {
    registerResizableRootElement()
    registerResizableHandleElement()

    const root = document.createElement('prosekit-resizable-root')
    root.className = 'md-image-resizable'
    root.dataset.testid = 'image-resizable'
    // Show a placeholder background until the image paints, so a freshly dropped,
    // not-yet-loaded image still fills a visible box. Removed on load/error.
    root.setAttribute('data-loading', '')

    const image = document.createElement('img')
    image.src = url
    image.alt = this.#attrs.alt
    image.draggable = false
    // A persisted size is known up front, so seed both dimensions before the
    // image loads. This gives the box its final dimensions immediately, with no
    // layout shift when the natural size arrives.
    applyImageDisplaySize(root, image, this.#attrs.width, this.#attrs.height)
    image.addEventListener('load', () => {
      root.removeAttribute('data-loading')
      const ratio = image.naturalWidth / image.naturalHeight
      if (!Number.isFinite(ratio) || ratio <= 0) return
      root.setAttribute('data-aspect-ratio', String(ratio))
      // Reread the attrs: an update() may have landed while the image was loading.
      applyImageDisplaySize(root, image, this.#attrs.width, this.#attrs.height)
    })
    image.addEventListener('error', () => {
      root.removeAttribute('data-loading')
    })
    root.appendChild(image)

    const handle = document.createElement('prosekit-resizable-handle')
    handle.className = 'md-image-resize-handle'
    handle.setAttribute('position', 'bottom-right')
    // A click (no drag) on the handle must not bubble to the image-click handler.
    handle.addEventListener('click', (event) => event.stopPropagation())
    root.appendChild(handle)

    root.addEventListener('resizeEnd', (event) => {
      const { width: nextWidth, height: nextHeight } = (event as ResizeEndEvent).detail
      commitImageSize(this.#view, this.#contentDOM, nextWidth, nextHeight)
    })

    this.#resizableRoot = root
    this.#image = image
    return root
  }
}

/** Inline image/embed rendering: a mark view on the `mdImage` mark. */
export function defineImage(options: ImageOptions = {}): PlainExtension {
  return defineMarkView({
    name: 'mdImage' satisfies MarkName,
    constructor: (mark, view) => new ImageMarkView(mark, view, options),
  }) as PlainExtension
}
