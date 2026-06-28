import {
  defineMarkView,
  definePlugin,
  Priority,
  union,
  withPriority,
  type PlainExtension,
} from '@prosekit/core'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import type { EditorView, MarkViewConstructor } from '@prosekit/pm/view'
import {
  registerResizableHandleElement,
  registerResizableRootElement,
  type ResizeEndEvent,
} from '@prosekit/web/resizable'

import { listenForTweetHeight, matchEmbed, type EmbedDescriptor } from './embed/index.ts'
import { getMarkRangeAt } from './get-mark-range-at.ts'
import type { MdImageAttrs } from './inline-marks.ts'
import type { MarkName } from './mark-names.ts'
import { formatMetaComment, parseMetaComment, stripMetaComment } from './meta-comment.ts'

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

/** Build the inline preview for an image `src`: an embed iframe or a resizable `<img>`. */
function renderImagePreview(
  src: string,
  alt: string,
  width: number | null,
  options: ImageOptions,
  view: EditorView,
  content: HTMLElement,
): HTMLElement | undefined {
  const embed = matchEmbed(src)
  if (embed) {
    const wrapper = document.createElement('span')
    wrapper.className = 'md-image-view-preview md-atom-view-preview'
    wrapper.appendChild(buildEmbedIframe(embed))
    return wrapper
  }

  const url = (options.resolveImageUrl ?? defaultResolveImageUrl)(src)
  if (!url) return undefined

  const wrapper = document.createElement('span')
  wrapper.className = 'md-image-view-preview md-atom-view-preview'
  wrapper.dataset.testid = 'image-preview'
  wrapper.appendChild(buildResizableImage(url, alt, width, view, content))
  return wrapper
}

/**
 * A resizable `<img>`: ProseKit's resizable web component wrapping the image, plus
 * a drag handle. Releasing a drag writes the new width into the markdown source as
 * a `<!-- {"width":N} -->` comment, which the inline-mark plugin re-derives back
 * into the mark's `width` attribute.
 */
function buildResizableImage(
  url: string,
  alt: string,
  width: number | null,
  view: EditorView,
  content: HTMLElement,
): HTMLElement {
  registerResizableRootElement()
  registerResizableHandleElement()

  const root = document.createElement('prosekit-resizable-root')
  root.className = 'md-image-resizable'
  root.dataset.testid = 'image-resizable'
  if (width != null) root.setAttribute('data-width', String(width))

  const img = document.createElement('img')
  img.src = url
  img.alt = alt
  img.draggable = false
  img.addEventListener('load', () => {
    const ratio = img.naturalWidth / img.naturalHeight
    if (Number.isFinite(ratio) && ratio > 0) {
      root.setAttribute('data-aspect-ratio', String(ratio))
    }
    // The component renders at 1px when width is null; feed it the natural width
    // for display only (never persisted). CSS max-width clamps oversized images.
    if (width == null && img.naturalWidth > 0) {
      root.setAttribute('data-width', String(img.naturalWidth))
    }
  })
  root.appendChild(img)

  const handle = document.createElement('prosekit-resizable-handle')
  handle.className = 'md-image-resize-handle'
  handle.setAttribute('position', 'bottom-right')
  // A click (no drag) on the handle must not bubble to the image-click handler.
  handle.addEventListener('click', (event) => event.stopPropagation())
  root.appendChild(handle)

  root.addEventListener('resizeEnd', (event) => {
    commitImageWidth(view, content, (event as ResizeEndEvent).detail.width)
  })

  return root
}

/**
 * Persist a resized width by rewriting only the trailing metadata comment, leaving
 * the `![alt](url)` source untouched. The inline-mark plugin re-derives the
 * `width` attribute from the new text.
 */
function commitImageWidth(view: EditorView, content: HTMLElement, rawWidth: number): void {
  const pos = view.posAtDOM(content, 0)
  const range = getMarkRangeAt(view.state, pos, 'mdImage')
  if (!range) return
  const current = view.state.doc.textBetween(range.from, range.to)

  // Split the range into the `![alt](url)` source and its optional comment;
  // positions in a textblock are 1:1 with characters, so `from + base.length` is
  // exactly where the source ends and the comment begins.
  const base = stripMetaComment(current)
  const commentFrom = range.from + base.length
  const currentComment = current.slice(base.length)

  const nextComment = formatMetaComment({
    ...(parseMetaComment(currentComment) ?? {}),
    width: Math.round(rawWidth),
  })
  if (nextComment === currentComment) return

  view.dispatch(view.state.tr.insertText(nextComment, commentFrom, range.to))
}

function createImageMarkView(options: ImageOptions): MarkViewConstructor {
  return (mark, view) => {
    const { src, alt, width } = mark.attrs as MdImageAttrs

    const dom = document.createElement('span')
    dom.className = 'md-image-view md-atom-view'

    const contentDOM = document.createElement('span')
    contentDOM.className = 'md-image-view-content md-atom-view-content'

    const preview = renderImagePreview(src, alt, width, options, view, contentDOM)
    if (preview) {
      preview.contentEditable = 'false'
      dom.appendChild(preview)
    }

    dom.appendChild(contentDOM)

    return {
      dom,
      contentDOM,
      ignoreMutation: (mutation) => !contentDOM.contains(mutation.target),
    }
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
      constructor: createImageMarkView(options),
    }),
    // High priority so the drop/paste handler runs before ProseKit's
    // drop-indicator plugin.
    withPriority(definePlugin(createImageInputPlugin(options)), Priority.high),
  ) as PlainExtension
}
