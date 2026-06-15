import { definePlugin, Priority, union, withPriority, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey, type EditorState } from '@prosekit/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@prosekit/pm/view'

import { scanInlineImages } from '../converters/scan-inline-images.ts'

export interface ImageOptions {
  /** Map a markdown `src` to a displayable URL, or `undefined` to skip rendering. */
  resolveImageUrl: (src: string) => string | undefined
  /** Persist a pasted/dropped image file and return its markdown `src`, or `undefined` to decline. */
  onImagePaste?: (file: File) => string | undefined | Promise<string | undefined>
  /** Called when persisting a pasted/dropped image throws. Defaults to `console.error`. */
  onImageSaveError?: (error: unknown, file: File) => void
}

const imageKey = new PluginKey<DecorationSet>('meowdown-images')

interface ImageRange {
  widgetAt: number
  alt: string
  src: string
}

/** Every renderable image in the document. `![alt](src)` stays literal text. */
function computeImageRanges(state: EditorState): ImageRange[] {
  const ranges: ImageRange[] = []
  state.doc.descendants((node, pos) => {
    if (node.type.spec.code) return false
    if (!node.isTextblock) return true
    if (node.childCount === 0) return false
    let allText = true
    node.forEach((child) => {
      if (!child.isText) allText = false
    })
    if (!allText) return false
    for (const image of scanInlineImages(node.textContent)) {
      ranges.push({ widgetAt: pos + node.nodeSize - 1, alt: image.alt, src: image.src })
    }
    return false
  })
  return ranges
}

function buildImageDecorations(state: EditorState, options: ImageOptions): DecorationSet {
  const decorations: Decoration[] = []
  for (const range of computeImageRanges(state)) {
    const url = options.resolveImageUrl(range.src)
    if (!url) continue
    decorations.push(
      Decoration.widget(
        range.widgetAt,
        () => {
          const figure = document.createElement('div')
          figure.className = 'md-image'
          figure.contentEditable = 'false'
          const img = document.createElement('img')
          img.src = url
          img.alt = range.alt
          img.draggable = false
          figure.appendChild(img)
          return figure
        },
        // Keyed by url so ProseMirror reuses the DOM node and the image never reloads.
        { key: `md-image:${url}`, side: 1 },
      ),
    )
  }
  return DecorationSet.create(state.doc, decorations)
}

function createImageRenderPlugin(options: ImageOptions): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: imageKey,
    state: {
      init: (_config, state) => buildImageDecorations(state, options),
      apply: (tr, value, _oldState, newState) =>
        tr.docChanged ? buildImageDecorations(newState, options) : value,
    },
    props: {
      decorations: (state) => imageKey.getState(state),
    },
  })
}

function imageFiles(data: DataTransfer | null): File[] {
  if (!data) return []
  return Array.from(data.files).filter((file) => file.type.startsWith('image/'))
}

function reportImageError(
  onImageSaveError: ImageOptions['onImageSaveError'],
  error: unknown,
  file: File,
): void {
  if (onImageSaveError) onImageSaveError(error, file)
  else console.error('[meowdown] failed to save pasted image:', error)
}

async function insertSavedImages(
  view: EditorView,
  files: File[],
  onImagePaste: NonNullable<ImageOptions['onImagePaste']>,
  onImageSaveError: ImageOptions['onImageSaveError'],
  at?: number,
): Promise<void> {
  let position = at
  for (const file of files) {
    let saved: string | undefined
    try {
      saved = await onImagePaste(file)
    } catch (error) {
      reportImageError(onImageSaveError, error, file)
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
    props: {
      handlePaste: (view, event) => {
        const files = imageFiles(event.clipboardData)
        const onImagePaste = options.onImagePaste
        if (files.length === 0 || !onImagePaste) return false
        void insertSavedImages(view, files, onImagePaste, options.onImageSaveError)
        return true
      },
      handleDrop: (view, event) => {
        const files = imageFiles(event.dataTransfer)
        const onImagePaste = options.onImagePaste
        if (files.length === 0 || !onImagePaste) return false
        const drop = view.posAtCoords({ left: event.clientX, top: event.clientY })
        void insertSavedImages(view, files, onImagePaste, options.onImageSaveError, drop?.pos)
        return true
      },
    },
  })
}

/** Inline image rendering (widget decorations) plus paste/drop persistence. */
export function defineImages(options: ImageOptions): PlainExtension {
  return union(
    definePlugin(createImageRenderPlugin(options)),
    // High priority so the drop/paste handler runs before ProseKit's
    // drop-indicator plugin, whose default-priority handleDrop otherwise
    // consumes external file drops before this one sees them.
    withPriority(definePlugin(createImageInputPlugin(options)), Priority.high),
  )
}
