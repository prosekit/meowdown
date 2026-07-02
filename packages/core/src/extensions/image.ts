import {
  defineMarkView,
  definePlugin,
  Priority,
  union,
  withPriority,
  type PlainExtension,
} from '@prosekit/core'
import type { Mark } from '@prosekit/pm/model'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import type { EditorView, MarkView, ViewMutationRecord } from '@prosekit/pm/view'
import {
  registerResizableHandleElement,
  registerResizableRootElement,
  type ResizeEndEvent,
} from '@prosekit/web/resizable'

import { listenForTweetHeight, matchEmbed, type EmbedDescriptor } from './embed/index.ts'
import { getMarkRangeAt } from './get-mark-range-at.ts'
import type { MdImageAttrs } from './inline-marks.ts'
import { formatMagicComment, parseMagicComment, stripMagicComment } from './magic-comment.ts'
import type { MarkName } from './mark-names.ts'

type ImageUrlResolver = (src: string) => string | undefined
type ImagePasteHandler = (file: File) => string | undefined | Promise<string | undefined>
type ImageSaveErrorHandler = (error: unknown, file: File) => void

export interface ImageOptions {
  /**
   * Map a markdown `src` to a displayable URL, or `undefined` to skip rendering
   * that image. Defaults to `defaultResolveImageUrl`.
   */
  resolveImageUrl?: ImageUrlResolver
  /** Persist a pasted/dropped image file and return its markdown `src`, or `undefined` to decline. */
  onImagePaste?: ImagePasteHandler
  /** Called when persisting a pasted/dropped image throws. Defaults to `console.error`. */
  onImageSaveError?: ImageSaveErrorHandler
}

/** Show an `src` as-is when it is an http(s) URL, otherwise skip rendering it. */
export function defaultResolveImageUrl(src: string): string | undefined {
  return /^https?:\/\//i.test(src) ? src : undefined
}

/**
 * Default cap on an image's displayed height in CSS pixels.
 */
const MAX_DISPLAY_HEIGHT = 500

/** Build the iframe DOM for an embed descriptor and start its height listener. */
function buildEmbedIframe(embed: EmbedDescriptor): HTMLIFrameElement {
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
  if (embed.kind === 'tweet') listenForTweetHeight(iframe)
  return iframe
}

/**
 * Write the display size onto the resizable root. Persisted dimensions win;
 * missing ones derive from the image's natural size (capping the height at
 * MAX_DISPLAY_HEIGHT, never upscaling). Before the image has loaded, only the
 * persisted dimensions are seeded; the load listener fills in the rest.
 */
function applyDisplaySize(
  root: HTMLElement,
  image: HTMLImageElement,
  width: number | null,
  height: number | null,
): void {
  if (width != null && height != null) {
    root.setAttribute('data-width', String(width))
    root.setAttribute('data-height', String(height))
    return
  }
  const ratio = image.naturalWidth / image.naturalHeight
  if (!Number.isFinite(ratio) || ratio <= 0) {
    if (width != null) root.setAttribute('data-width', String(width))
    if (height != null) root.setAttribute('data-height', String(height))
    return
  }
  const displayHeight =
    width == null ? Math.min(image.naturalHeight, MAX_DISPLAY_HEIGHT) : width / ratio
  const displayWidth = width ?? displayHeight * ratio
  root.setAttribute('data-width', String(Math.round(displayWidth)))
  root.setAttribute('data-height', String(Math.round(displayHeight)))
}

/**
 * Persist a resized width and height by rewriting only the trailing magic
 * comment, leaving the `![alt](url)` source untouched. The inline-mark plugin
 * re-derives the `width`/`height` attributes from the new text.
 */
function commitImageSize(
  view: EditorView,
  content: HTMLElement,
  rawWidth: number,
  rawHeight: number,
): void {
  const pos = view.posAtDOM(content, 0)
  const range = getMarkRangeAt(view.state, pos, 'mdImage')
  if (!range) return
  const current = view.state.doc.textBetween(range.from, range.to)

  // Split the range into the `![alt](url)` source and its optional comment;
  // positions in a textblock are 1:1 with characters, so `from + base.length` is
  // exactly where the source ends and the comment begins.
  const base = stripMagicComment(current)
  const commentFrom = range.from + base.length
  const currentComment = current.slice(base.length)

  const nextComment = formatMagicComment({
    ...(parseMagicComment(currentComment) ?? {}),
    width: Math.round(rawWidth),
    height: Math.round(rawHeight),
  })
  if (nextComment === currentComment) return

  view.dispatch(view.state.tr.insertText(nextComment, commentFrom, range.to))
}

class ImageMarkView implements MarkView {
  readonly #dom: HTMLElement
  readonly #contentDOM: HTMLElement
  readonly #options: ImageOptions
  readonly #view: EditorView
  #attrs: MdImageAttrs
  #resizableRoot: HTMLElement | undefined
  #image: HTMLImageElement | undefined

  constructor(mark: Mark, view: EditorView, options: ImageOptions) {
    this.#attrs = mark.attrs as MdImageAttrs
    this.#options = options
    this.#view = view

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
    if (
      this.#resizableRoot &&
      this.#image &&
      (next.width !== previous.width || next.height !== previous.height)
    ) {
      applyDisplaySize(this.#resizableRoot, this.#image, next.width, next.height)
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
      wrapper.appendChild(buildEmbedIframe(embed))
      return wrapper
    }

    const url = (this.#options.resolveImageUrl ?? defaultResolveImageUrl)(src)
    if (!url) return undefined

    const wrapper = document.createElement('span')
    wrapper.className = 'md-image-view-preview md-atom-view-preview'
    wrapper.dataset.testid = 'image-preview'
    wrapper.appendChild(this.#buildResizableImage(url))
    return wrapper
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
    applyDisplaySize(root, image, this.#attrs.width, this.#attrs.height)
    image.addEventListener('load', () => {
      root.removeAttribute('data-loading')
      const ratio = image.naturalWidth / image.naturalHeight
      if (!Number.isFinite(ratio) || ratio <= 0) return
      root.setAttribute('data-aspect-ratio', String(ratio))
      // Reread the attrs: an update() may have landed while the image was loading.
      applyDisplaySize(root, image, this.#attrs.width, this.#attrs.height)
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

function filterImageFiles(data: DataTransfer | null): File[] {
  if (!data) return []
  return Array.from(data.files).filter((file) => file.type.startsWith('image/'))
}

const defaultOnImageSaveError: ImageSaveErrorHandler = (error) => {
  console.error('[meowdown] failed to save pasted image:', error)
}

async function insertSavedImages(
  view: EditorView,
  files: File[],
  onImagePaste: ImagePasteHandler,
  onImageSaveError: ImageSaveErrorHandler = defaultOnImageSaveError,
  at?: number,
): Promise<void> {
  let position = at
  for (const file of files) {
    let saved: string | undefined
    try {
      saved = await onImagePaste(file)
    } catch (error) {
      onImageSaveError(error, file)
      continue
    }
    if (!saved || view.isDestroyed) continue
    const markdown = `![](${saved})`
    const transaction =
      position == null
        ? view.state.tr.insertText(markdown)
        : view.state.tr.insertText(markdown, position)
    view.dispatch(transaction)
    // Chain later drops after the one just inserted.
    if (position != null) position += markdown.length
  }
}

function createImageInputPlugin(options: ImageOptions): Plugin {
  return new Plugin({
    key: new PluginKey('image-input'),
    props: {
      handlePaste: (view, event) => {
        const files = filterImageFiles(event.clipboardData)
        const { onImagePaste, onImageSaveError } = options
        if (files.length === 0 || !onImagePaste) return false
        void insertSavedImages(view, files, onImagePaste, onImageSaveError)
        return true
      },
      handleDrop: (view, event) => {
        const files = filterImageFiles(event.dataTransfer)
        const { onImagePaste, onImageSaveError } = options
        if (files.length === 0 || !onImagePaste) return false
        const drop = view.posAtCoords({ left: event.clientX, top: event.clientY })
        void insertSavedImages(view, files, onImagePaste, onImageSaveError, drop?.pos)
        return true
      },
    },
  })
}

/** Inline image/embed rendering (a mark view) plus paste/drop persistence. */
export function defineImage(options: ImageOptions = {}): PlainExtension {
  return union(
    defineMarkView({
      name: 'mdImage' satisfies MarkName,
      constructor: (mark, view) => new ImageMarkView(mark, view, options),
    }),
    // High priority so the drop/paste handler runs before ProseKit's
    // drop-indicator plugin.
    withPriority(definePlugin(createImageInputPlugin(options)), Priority.high),
  ) as PlainExtension
}
