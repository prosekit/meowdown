import { union, type PlainExtension } from '@prosekit/core'
import type { Uploader } from '@prosekit/extensions/file'

import { defineImagePreview } from './image-preview.ts'
import { defineImageUpload } from './image-upload.ts'

/** Maps a Markdown image src to a displayable URL, or null to not render it. */
export type ImageUrlResolver = (src: string) => string | null

/**
 * Persists a pasted or dropped image file and resolves to the src to embed in
 * the Markdown (a relative path, a remote URL...). Sync or async. Reject to
 * signal failure (the optimistic placeholder is then removed).
 */
export type ImageUploadHandler = (file: File) => string | Promise<string>

/**
 * Decides whether a pasted or dropped file should be uploaded. Runs before any
 * placeholder is inserted. Defaults to accepting `image/*` files.
 */
export type ImageUploadPredicate = (file: File) => boolean

/** Called when an upload throws or rejects, with the file that failed. */
export type ImageUploadErrorHandler = (options: { error: unknown; file: File }) => void

export interface ImageExtensionOptions {
  /**
   * Maps a Markdown src to a displayable URL, or null to not render it.
   * Defaults to a safe absolute-URL pass-through (`defaultResolveImageUrl`).
   */
  resolveUrl?: ImageUrlResolver

  /**
   * Persists a pasted or dropped image and resolves to the src to embed. Omit
   * to disable paste/drop handling entirely.
   */
  upload?: ImageUploadHandler

  /** Decides which files to upload. Defaults to accepting `image/*` files. */
  canUpload?: ImageUploadPredicate

  /** Called when `upload` throws or rejects. Defaults to `console.error`. */
  onUploadError?: ImageUploadErrorHandler
}

/**
 * Renders `![alt](src)` Markdown as an inline image preview, and (when
 * `upload` is given) turns pasted or dropped image files into `![](src)`
 * text. The document never holds an image node: the literal Markdown text
 * stays the source of truth, so serialization is unaffected.
 *
 * On paste/drop a placeholder `![](blob:...)` is inserted immediately (so the
 * local image shows at once), then the `blob:` src is swapped for the uploaded
 * one once `upload` resolves.
 */
export function defineImageExtension(options: ImageExtensionOptions = {}): PlainExtension {
  const resolveUrl = options.resolveUrl ?? defaultResolveImageUrl
  const preview = defineImagePreview(resolveUrl)
  const upload = options.upload
  if (!upload) return preview
  const uploader: Uploader<string> = ({ file }) => Promise.resolve(upload(file))
  return union(
    preview,
    defineImageUpload({
      uploader,
      canUpload: options.canUpload ?? defaultCanUpload,
      onError: options.onUploadError ?? logUploadError,
    }),
  )
}

function defaultCanUpload(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * Safe default resolver: passes through `data:image/*`, `http:`, `https:`,
 * and `blob:` URLs; returns null for everything else (relative paths,
 * `javascript:`, unknown schemes), since only the host knows what a relative
 * path means and unknown schemes must never render.
 */
export function defaultResolveImageUrl(src: string): string | null {
  if (src.startsWith('data:image/')) return src
  try {
    const protocol = new URL(src).protocol
    return protocol === 'http:' || protocol === 'https:' || protocol === 'blob:' ? src : null
  } catch {
    return null
  }
}

function logUploadError({ error }: { error: unknown; file: File }): void {
  console.error(error)
}
