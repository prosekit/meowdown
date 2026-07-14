import { definePlugin, Priority, withPriority, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

export type FilePasteHandler = (file: File) => string | undefined | Promise<string | undefined>
export type FileSaveErrorHandler = (error: unknown, file: File) => void

const IMAGE_FILE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'])

/** Options for {@link defineFilePaste}. */
export interface FilePasteOptions {
  /**
   * Persist a pasted/dropped file and return its markdown destination, or
   * `undefined` to decline (nothing is inserted, but the event is consumed).
   * An image (`image/*` MIME type or a recognized image filename extension)
   * inserts `![](src)`; any other file inserts a `[name](src)` link.
   */
  onFilePaste?: FilePasteHandler
  /** Called when persisting a pasted/dropped file throws. Defaults to `console.error`. */
  onFileSaveError?: FileSaveErrorHandler
}

function isImageFile(file: { name: string; type?: string }): boolean {
  if (file.type?.startsWith('image/')) return true

  const extensionSeparator = file.name.lastIndexOf('.')
  if (extensionSeparator === -1) return false

  const extension = file.name.slice(extensionSeparator + 1).toLowerCase()
  return IMAGE_FILE_EXTENSIONS.has(extension)
}

/**
 * The markdown a saved file becomes: `![](destination)` for an image (a
 * `type` starting with `image/` or a recognized image filename extension), a
 * `[name](destination)` link otherwise, with `\`, `[`, and `]` escaped in the
 * name. Exported so a host command that inserts file links itself (e.g. an
 * attach-file picker) produces markdown byte-identical to a paste/drop.
 */
export function buildFileMarkdown(
  file: { name: string; type?: string },
  destination: string,
): string {
  return isImageFile(file)
    ? `![](${destination})`
    : `[${escapeLinkText(file.name)}](${destination})`
}

/**
 * The files a configured `onFilePaste` can take, in DataTransfer order.
 * Without a handler no file is taken, so the event is not consumed and the
 * browser's default handling stays in charge.
 */
function takePastedFiles(data: DataTransfer | null, options: FilePasteOptions): File[] {
  if (!data || !options.onFilePaste) return []
  return Array.from(data.files)
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
  files: File[],
  options: FilePasteOptions,
  at?: number,
): Promise<void> {
  const { onFilePaste } = options
  if (!onFilePaste) return
  const onSaveError = options.onFileSaveError ?? defaultOnFileSaveError
  let position = at
  let insertedAny = false
  for (const file of files) {
    let saved: string | undefined
    try {
      saved = await onFilePaste(file)
    } catch (error) {
      onSaveError(error, file)
      continue
    }
    if (!saved || view.isDestroyed) continue
    const link = buildFileMarkdown(file, saved)
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

function createFilePastePlugin(options: FilePasteOptions): Plugin {
  return new Plugin({
    key: new PluginKey('file-paste'),
    props: {
      handlePaste: (view, event) => {
        const files = takePastedFiles(event.clipboardData, options)
        if (files.length === 0) return false
        void insertSavedFiles(view, files, options)
        return true
      },
      handleDrop: (view, event) => {
        const files = takePastedFiles(event.dataTransfer, options)
        if (files.length === 0) return false
        const drop = view.posAtCoords({ left: event.clientX, top: event.clientY })
        void insertSavedFiles(view, files, options, drop?.pos)
        return true
      },
    },
  })
}

/**
 * Persist pasted/dropped files via `onFilePaste` and insert the returned
 * markdown destination: `![](src)` for an image, a `[name](src)` link for any
 * other file. Multiple files insert one link per line, in DataTransfer order.
 */
export function defineFilePaste(options: FilePasteOptions = {}): PlainExtension {
  // High priority so the drop/paste handler runs before ProseKit's
  // drop-indicator plugin.
  return withPriority(definePlugin(createFilePastePlugin(options)), Priority.high)
}
