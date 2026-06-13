import { union, type PlainExtension } from '@prosekit/core'
import {
  defineFileDropHandler,
  defineFilePasteHandler,
  UploadTask,
  type Uploader,
} from '@prosekit/extensions/file'
import type { EditorNode } from '@prosekit/pm/model'
import type { EditorView } from '@prosekit/pm/view'

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
 * Re-scan the document for every placeholder carrying `src`. We insert an exact
 * `![](src)` token whose `blob:` object URL is unique, so a plain substring
 * search recovers its position (and any copies) without re-parsing: robust
 * against concurrent edits, undo, and doc rebuilds, and naturally handling zero
 * matches (deleted under us) or many (the placeholder was duplicated).
 */
function findPlacedImages(doc: EditorNode, src: string): PlacedImage[] {
  const out: PlacedImage[] = []
  const token = `![](${src})`
  doc.descendants((node, pos) => {
    if (node.type.spec.code) return false
    if (!node.isTextblock) return true
    const text = node.textContent
    const base = pos + 1
    let index = text.indexOf(token)
    while (index !== -1) {
      const from = base + index
      const srcFrom = from + 4 // skip the leading `![](`
      out.push({ from, to: from + token.length, srcFrom, srcTo: srcFrom + src.length })
      index = text.indexOf(token, index + token.length)
    }
    return false
  })
  return out
}

function startUpload(
  view: EditorView,
  file: File,
  options: ResolvedUploadOptions,
  insertPlaceholder: (markdown: string) => void,
): void {
  const task = new UploadTask({ file, uploader: options.uploader })
  const objectURL = task.objectURL
  insertPlaceholder(`![](${objectURL})`)
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

/** Paste: insert the placeholder inline, at the caret. */
function insertInline(view: EditorView, markdown: string): void {
  view.dispatch(view.state.tr.insertText(markdown))
}

/** Drop: insert the placeholder as its own block at the drop position. */
function insertBlock(view: EditorView, markdown: string, pos: number): void {
  const { state } = view
  const paragraph = state.schema.nodes.paragraph.createAndFill(null, state.schema.text(markdown))
  if (!paragraph) return
  const clamped = Math.min(Math.max(pos, 0), state.doc.content.size)
  const $pos = state.doc.resolve(clamped)
  // A block can only land at a block boundary: before the textblock the drop
  // fell inside, or at the given position when it is already between blocks.
  const at = $pos.parent.isTextblock ? $pos.before() : $pos.pos
  view.dispatch(state.tr.insert(at, paragraph))
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
  options: ResolvedUploadOptions,
  insertPlaceholder: (markdown: string) => void,
): boolean {
  if (!options.canUpload(file)) return false
  startUpload(view, file, options, insertPlaceholder)
  // Returning true consumes the event (ProseMirror calls preventDefault), so a
  // clipboard carrying image files is handled entirely.
  return true
}

export function defineImageUpload(options: ResolvedUploadOptions): PlainExtension {
  return union(
    // Paste lands inline at the caret; drop lands as its own block at the drop
    // position (the conventional behavior for a dropped image file).
    defineFilePasteHandler(({ view, file }) =>
      handleFile(view, file, options, (markdown) => insertInline(view, markdown)),
    ),
    defineFileDropHandler(({ view, file, pos }) =>
      handleFile(view, file, options, (markdown) => insertBlock(view, markdown, pos)),
    ),
  )
}
