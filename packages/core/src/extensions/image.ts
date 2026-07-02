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
import { formatMagicComment, parseMagicComment, stripMagicComment } from './magic-comment.ts'
import type { MarkName } from './mark-names.ts'

type ImageUrlResolver = (src: string) => string | undefined
type FilePasteHandler = (file: File) => string | undefined | Promise<string | undefined>
type FileSaveErrorHandler = (error: unknown, file: File) => void

export interface ImageOptions {
  /**
   * Map a markdown `src` to a displayable URL, or `undefined` to skip rendering
   * that image. Defaults to `defaultResolveImageUrl`.
   */
  resolveImageUrl?: ImageUrlResolver
  /** Persist a pasted/dropped image file and return its markdown `src`, or `undefined` to decline. */
  onImagePaste?: FilePasteHandler
  /** Called for each pasted/dropped non-image file; returns the markdown link destination (or `undefined` to decline). */
  onFilePaste?: FilePasteHandler
  /** Called when persisting a pasted/dropped file (image or not) throws. Defaults to `console.error`. */
  onImageSaveError?: FileSaveErrorHandler
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

/** Build the inline preview for an image `src`: an embed iframe or a resizable `<img>`. */
function renderImagePreview(
  src: string,
  alt: string,
  width: number | null,
  height: number | null,
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
  wrapper.appendChild(buildResizableImage(url, alt, width, height, view, content))
  return wrapper
}

/**
 * A resizable `<img>`: ProseKit's resizable web component wrapping the image, plus
 * a drag handle. Releasing a drag writes the new width and height into the markdown
 * source as a `<!-- {"width":N,"height":M} -->` comment, which the inline-mark
 * plugin re-derives back into the mark's `width`/`height` attributes.
 */
function buildResizableImage(
  url: string,
  alt: string,
  width: number | null,
  height: number | null,
  view: EditorView,
  content: HTMLElement,
): HTMLElement {
  registerResizableRootElement()
  registerResizableHandleElement()

  const root = document.createElement('prosekit-resizable-root')
  root.className = 'md-image-resizable'
  root.dataset.testid = 'image-resizable'
  // Show a placeholder background until the image paints, so a freshly dropped,
  // not-yet-loaded image still fills a visible box. Removed on load/error.
  root.setAttribute('data-loading', '')
  // A persisted size is known up front, so seed both dimensions before the image
  // loads. This gives the box its final dimensions immediately, with no layout
  // shift when the natural size arrives.
  if (width != null) root.setAttribute('data-width', String(width))
  if (height != null) root.setAttribute('data-height', String(height))

  const img = document.createElement('img')
  img.src = url
  img.alt = alt
  img.draggable = false
  img.addEventListener('load', () => {
    root.removeAttribute('data-loading')
    const { naturalWidth, naturalHeight } = img
    const ratio = naturalWidth / naturalHeight
    if (!Number.isFinite(ratio) || ratio <= 0) return
    root.setAttribute('data-aspect-ratio', String(ratio))
    // A persisted size already seeded both dimensions above. Otherwise default to
    // the natural size, capping the height at MAX_DISPLAY_HEIGHT and never
    // upscaling, then derive the width. CSS max-width clamps the container.
    if (width != null && height != null) return
    const displayHeight =
      width == null ? Math.min(naturalHeight, MAX_DISPLAY_HEIGHT) : width / ratio
    const displayWidth = width ?? displayHeight * ratio
    root.setAttribute('data-width', String(Math.round(displayWidth)))
    root.setAttribute('data-height', String(Math.round(displayHeight)))
  })
  img.addEventListener('error', () => {
    root.removeAttribute('data-loading')
  })
  root.appendChild(img)

  const handle = document.createElement('prosekit-resizable-handle')
  handle.className = 'md-image-resize-handle'
  handle.setAttribute('position', 'bottom-right')
  // A click (no drag) on the handle must not bubble to the image-click handler.
  handle.addEventListener('click', (event) => event.stopPropagation())
  root.appendChild(handle)

  root.addEventListener('resizeEnd', (event) => {
    const { width: nextWidth, height: nextHeight } = (event as ResizeEndEvent).detail
    commitImageSize(view, content, nextWidth, nextHeight)
  })

  return root
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

function createImageMarkView(options: ImageOptions): MarkViewConstructor {
  return (mark, view) => {
    const { src, alt, width, height } = mark.attrs as MdImageAttrs

    const dom = document.createElement('span')
    dom.className = 'md-image-view md-atom-view'

    const contentDOM = document.createElement('span')
    contentDOM.className = 'md-image-view-content md-atom-view-content'

    const preview = renderImagePreview(src, alt, width, height, options, view, contentDOM)
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

interface PastedFile {
  file: File
  /** Which handler saves the file and which markdown it becomes. */
  kind: 'image' | 'file'
}

/**
 * Collect the files a configured handler can take, in DataTransfer order:
 * `image/*` files when `onImagePaste` is set, every other file when
 * `onFilePaste` is set. Files without a handler are left alone, so e.g. a
 * PDF drop with only `onImagePaste` configured is not consumed.
 */
function filterHandledFiles(data: DataTransfer | null, options: ImageOptions): PastedFile[] {
  if (!data) return []
  const handled: PastedFile[] = []
  for (const file of Array.from(data.files)) {
    const kind = file.type.startsWith('image/') ? 'image' : 'file'
    const handler = kind === 'image' ? options.onImagePaste : options.onFilePaste
    if (handler) handled.push({ file, kind })
  }
  return handled
}

const defaultOnFileSaveError: FileSaveErrorHandler = (error) => {
  console.error('[meowdown] failed to save pasted file:', error)
}

/** Escape `\`, `[`, and `]` so a filename stays inside its `[text]` label. */
function escapeLinkText(name: string): string {
  return name.replaceAll(/[\\[\]]/g, String.raw`\$&`)
}

async function insertSavedFiles(
  view: EditorView,
  files: PastedFile[],
  options: ImageOptions,
  at?: number,
): Promise<void> {
  const onSaveError = options.onImageSaveError ?? defaultOnFileSaveError
  let position = at
  let insertedAny = false
  for (const { file, kind } of files) {
    const save = kind === 'image' ? options.onImagePaste : options.onFilePaste
    if (!save) continue
    let saved: string | undefined
    try {
      saved = await save(file)
    } catch (error) {
      onSaveError(error, file)
      continue
    }
    if (!saved || view.isDestroyed) continue
    const link = kind === 'image' ? `![](${saved})` : `[${escapeLinkText(file.name)}](${saved})`
    // Each link after the first starts its own line. `\n` is a soft break in
    // this schema (paragraphs are `whitespace: 'pre'`) and serializes as a
    // literal newline, so the links round-trip one per line.
    const markdown = insertedAny ? `\n${link}` : link
    const transaction =
      position == null
        ? view.state.tr.insertText(markdown)
        : view.state.tr.insertText(markdown, position)
    view.dispatch(transaction)
    insertedAny = true
    // Chain later drops after the one just inserted.
    if (position != null) position += markdown.length
  }
}

function createImageInputPlugin(options: ImageOptions): Plugin {
  return new Plugin({
    key: new PluginKey('image-input'),
    props: {
      handlePaste: (view, event) => {
        const files = filterHandledFiles(event.clipboardData, options)
        if (files.length === 0) return false
        void insertSavedFiles(view, files, options)
        return true
      },
      handleDrop: (view, event) => {
        const files = filterHandledFiles(event.dataTransfer, options)
        if (files.length === 0) return false
        const drop = view.posAtCoords({ left: event.clientX, top: event.clientY })
        void insertSavedFiles(view, files, options, drop?.pos)
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
