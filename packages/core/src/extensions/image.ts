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

import { listenForTweetHeight, matchEmbed, type EmbedDescriptor } from './embed/index.ts'
import type { MdImageViewAttrs } from './inline-marks.ts'
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
function defaultResolveImageUrl(src: string): string | undefined {
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

/** Build the inline preview for an image `src`: an embed iframe or an `<img>`. */
function renderImagePreview(
  src: string,
  alt: string,
  options: ImageOptions,
): HTMLElement | undefined {
  const embed = matchEmbed(src)
  if (embed) {
    const wrapper = document.createElement('span')
    wrapper.className = 'md-image-preview md-image-preview-embed'
    wrapper.appendChild(buildEmbedIframe(embed))
    return wrapper
  }
  const url = (options.resolveImageUrl ?? defaultResolveImageUrl)(src)
  if (!url) return undefined
  const wrapper = document.createElement('span')
  wrapper.className = 'md-image-preview md-image-preview-img'
  wrapper.dataset.testid = 'image-preview'
  const img = document.createElement('img')
  img.src = url
  img.alt = alt
  img.draggable = false
  wrapper.appendChild(img)
  return wrapper
}

/**
 * Render `mdImageView` (anchored on the image's final character) as the inline
 * image: the anchor char stays editable inside `contentDOM`, and the preview is
 * a non-editable sibling. Mark-mode hides the surrounding `mdImageSource`, so
 * what remains visible is the preview, in place of the raw `![alt](url)`.
 */
function createImageMarkView(options: ImageOptions): MarkViewConstructor {
  return (mark) => {
    const attrs = mark.attrs as MdImageViewAttrs

    const dom = document.createElement('span')
    dom.className = 'md-image-view'
    const contentDOM = document.createElement('span')
    contentDOM.className = 'md-image-view-content'
    dom.appendChild(contentDOM)

    const preview = renderImagePreview(attrs.src, attrs.alt, options)
    if (preview) {
      preview.contentEditable = 'false'
      dom.appendChild(preview)
    }

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
      name: 'mdImageView' satisfies MarkName,
      constructor: createImageMarkView(options),
    }),
    // High priority so the drop/paste handler runs before ProseKit's
    // drop-indicator plugin.
    withPriority(definePlugin(createImageInputPlugin(options)), Priority.high),
  ) as PlainExtension
}
