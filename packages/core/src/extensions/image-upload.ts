import { union, type PlainExtension } from '@prosekit/core'
import {
  defineFileDropHandler,
  defineFilePasteHandler,
  UploadTask,
  type Uploader,
} from '@prosekit/extensions/file'
import type { EditorNode } from '@prosekit/pm/model'
import type { EditorView } from '@prosekit/pm/view'

import { findInlineImages } from './find-inline-images.ts'
import type { ImageUploadErrorHandler } from './images.ts'

export interface ResolvedUploadOptions {
  uploader: Uploader<string>
  canUpload: (file: File) => boolean
  onError: ImageUploadErrorHandler
}

/** One placed `![](src)` occurrence, in absolute document positions. */
interface PlacedImage {
  from: number
  to: number
  srcFrom: number
  srcTo: number
}

/**
 * Re-scan the document for every image whose `src` equals `src`. The temporary
 * `blob:` object URL is unique, so this recovers the placeholder's position
 * without any stored anchor: robust against concurrent edits, undo, and doc
 * rebuilds, and naturally handles zero matches (deleted under us) or many
 * (the placeholder was duplicated).
 */
function findPlacedImages(doc: EditorNode, src: string): PlacedImage[] {
  const out: PlacedImage[] = []
  doc.descendants((node, pos) => {
    if (node.type.spec.code) return false
    if (!node.isTextblock) return true
    const text = node.textContent
    if (text.includes(src)) {
      const base = pos + 1
      for (const image of findInlineImages(text)) {
        if (image.src !== src) continue
        const srcOffset = text.indexOf(src, image.from)
        out.push({
          from: base + image.from,
          to: base + image.to,
          srcFrom: base + srcOffset,
          srcTo: base + srcOffset + src.length,
        })
      }
    }
    return false
  })
  return out
}

function startUpload(
  view: EditorView,
  file: File,
  pos: number | undefined,
  options: ResolvedUploadOptions,
): void {
  const task = new UploadTask({ file, uploader: options.uploader })
  const objectURL = task.objectURL
  insertPlaceholder(view, `![](${objectURL})`, pos)
  task.finished.then(
    (resultURL) => {
      if (!view.isDestroyed) replaceMatches(view, objectURL, resultURL)
      UploadTask.delete(objectURL)
    },
    (error: unknown) => {
      options.onError({ error, file })
      // A blob URL must never persist into saved Markdown, so a failed upload
      // removes its optimistic placeholder.
      if (!view.isDestroyed) removeMatches(view, objectURL)
      URL.revokeObjectURL(objectURL)
      UploadTask.delete(objectURL)
    },
  )
}

function insertPlaceholder(view: EditorView, markdown: string, pos: number | undefined): void {
  const tr =
    pos == null ? view.state.tr.insertText(markdown) : view.state.tr.insertText(markdown, pos)
  view.dispatch(tr)
}

function replaceMatches(view: EditorView, oldSrc: string, newSrc: string): void {
  const placed = findPlacedImages(view.state.doc, oldSrc)
  if (placed.length === 0) return
  const tr = view.state.tr
  // Back-to-front so earlier ranges stay valid as the doc is rewritten.
  for (let i = placed.length - 1; i >= 0; i--) {
    tr.insertText(newSrc, placed[i].srcFrom, placed[i].srcTo)
  }
  // Not its own undo step: undo removes the whole image, not just the swap.
  tr.setMeta('addToHistory', false)
  view.dispatch(tr)
}

function removeMatches(view: EditorView, src: string): void {
  const placed = findPlacedImages(view.state.doc, src)
  if (placed.length === 0) return
  const tr = view.state.tr
  for (let i = placed.length - 1; i >= 0; i--) {
    tr.delete(placed[i].from, placed[i].to)
  }
  tr.setMeta('addToHistory', false)
  view.dispatch(tr)
}

function handleFile(
  view: EditorView,
  file: File,
  pos: number | undefined,
  options: ResolvedUploadOptions,
): boolean {
  if (!options.canUpload(file)) return false
  startUpload(view, file, pos, options)
  // Returning true consumes the event (ProseMirror calls preventDefault), so a
  // clipboard carrying image files is handled entirely.
  return true
}

export function defineImageUpload(options: ResolvedUploadOptions): PlainExtension {
  return union(
    defineFilePasteHandler(({ view, file }) => handleFile(view, file, undefined, options)),
    defineFileDropHandler(({ view, event, file }) => {
      // The handler's own `pos` is computed for block insertion; for literal
      // text we want the nearest text position, so recompute from the event.
      const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
      return handleFile(view, file, coords?.pos, options)
    }),
  )
}
