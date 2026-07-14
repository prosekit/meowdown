import { defineMarkView, type PlainExtension } from '@prosekit/core'
import type { Mark } from '@prosekit/pm/model'
import type { MarkView, ViewMutationRecord } from '@prosekit/pm/view'

import { formatFileSize } from '../utils/format-file-size.ts'

import type { MdFileAttrs } from './inline-marks.ts'
import type { MarkName } from './mark-names.ts'

/** Metadata a host resolves for one file link, shown on its pill. */
export interface FileInfo {
  /** File size in bytes, shown as a human-readable suffix (e.g. `1.4 MB`). */
  size?: number
}

/**
 * Resolve display metadata for a file `href`, directly or as a promise; the
 * pill renders immediately and fills the metadata in when the promise
 * settles. Return `undefined` for a file without metadata (e.g. one that no
 * longer exists). Called once per rendered pill, so the same `href` may
 * resolve repeatedly: cache in the host when resolving is expensive.
 */
export type FileInfoResolver = (
  href: string,
) => FileInfo | undefined | Promise<FileInfo | undefined>

/** Options for {@link defineFileView}. */
export interface FileViewOptions {
  /** Resolve the metadata (file size) shown on a pill. Omit to show none. */
  resolveFileInfo?: FileInfoResolver
}

/** `data-file-kind` values by file extension, for host CSS theming. */
const FILE_KIND_BY_EXTENSION: ReadonlyMap<string, string> = new Map([
  ['pdf', 'pdf'],
  ['zip', 'archive'],
  ['tar', 'archive'],
  ['gz', 'archive'],
  ['tgz', 'archive'],
  ['rar', 'archive'],
  ['7z', 'archive'],
  ['doc', 'doc'],
  ['docx', 'doc'],
  ['pages', 'doc'],
  ['xls', 'sheet'],
  ['xlsx', 'sheet'],
  ['csv', 'sheet'],
  ['numbers', 'sheet'],
  ['ppt', 'slides'],
  ['pptx', 'slides'],
  ['key', 'slides'],
  ['mp3', 'audio'],
  ['wav', 'audio'],
  ['m4a', 'audio'],
  ['flac', 'audio'],
  ['ogg', 'audio'],
  ['mp4', 'video'],
  ['mov', 'video'],
  ['mkv', 'video'],
  ['webm', 'video'],
  ['txt', 'text'],
  ['md', 'text'],
])

/** Classify a file destination for the pill's `data-file-kind` attribute. */
export function getFileKind(href: string): string {
  const path = href.split(/[?#]/, 1)[0]
  const dot = path.lastIndexOf('.')
  if (dot < 0) return 'generic'
  const extension = path.slice(dot + 1).toLowerCase()
  return FILE_KIND_BY_EXTENSION.get(extension) ?? 'generic'
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** A minimal document-outline icon, drawn in `currentColor`. */
function buildFileIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'md-file-view-icon')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  for (const shape of [
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
    'M14 2v4a2 2 0 0 0 2 2h4',
  ]) {
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', shape)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', 'currentColor')
    path.setAttribute('stroke-width', '2')
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    svg.appendChild(path)
  }
  return svg
}

class FileMarkView implements MarkView {
  readonly #dom: HTMLElement
  readonly #contentDOM: HTMLElement
  readonly #preview: HTMLElement
  readonly #nameElement: HTMLElement
  readonly #sizeElement: HTMLElement
  #attrs: MdFileAttrs
  #destroyed = false

  constructor(mark: Mark, options: FileViewOptions) {
    this.#attrs = mark.attrs as MdFileAttrs

    this.#dom = document.createElement('span')
    this.#dom.className = 'md-file-view md-atom-view'

    this.#preview = document.createElement('span')
    this.#preview.className = 'md-file-view-preview md-atom-view-preview'
    this.#preview.contentEditable = 'false'
    this.#preview.dataset.testid = 'file-pill'
    this.#preview.dataset.fileKind = getFileKind(this.#attrs.href)
    // Tooltip fallback for a name the pill truncates with an ellipsis.
    this.#preview.title = this.#attrs.name
    this.#dom.appendChild(this.#preview)

    this.#preview.appendChild(buildFileIcon())

    this.#nameElement = document.createElement('span')
    this.#nameElement.className = 'md-file-view-name'
    this.#nameElement.textContent = this.#attrs.name
    this.#preview.appendChild(this.#nameElement)

    this.#sizeElement = document.createElement('span')
    this.#sizeElement.className = 'md-file-view-size'
    this.#sizeElement.dataset.testid = 'file-pill-size'
    this.#preview.appendChild(this.#sizeElement)

    this.#contentDOM = document.createElement('span')
    this.#contentDOM.className = 'md-file-view-content md-atom-view-content'
    this.#dom.appendChild(this.#contentDOM)

    void this.#loadFileInfo(options.resolveFileInfo)
  }

  get dom(): HTMLElement {
    return this.#dom
  }

  get contentDOM(): HTMLElement {
    return this.#contentDOM
  }

  update(mark: Mark): boolean {
    const next = mark.attrs as MdFileAttrs
    const previous = this.#attrs
    // False rebuilds the view from the constructor: a new href changes the
    // file kind and must resolve its metadata afresh.
    if (next.href !== previous.href) return false
    this.#attrs = next
    if (next.name !== previous.name) {
      this.#nameElement.textContent = next.name
      this.#preview.title = next.name
    }
    return true
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return !this.#contentDOM.contains(mutation.target)
  }

  destroy(): void {
    this.#destroyed = true
  }

  /**
   * Fill the size slot once the host resolves it. The `href` of one view
   * instance never changes (`update` rebuilds on an href change), so at most
   * one resolve is in flight and `#destroyed` is the only guard a late
   * result needs.
   */
  async #loadFileInfo(resolveFileInfo: FileInfoResolver | undefined): Promise<void> {
    if (!resolveFileInfo) return
    let info: FileInfo | undefined
    try {
      info = await resolveFileInfo(this.#attrs.href)
    } catch (error) {
      console.error('[meowdown] resolveFileInfo failed:', error)
      return
    }
    if (this.#destroyed || !info) return
    const { size } = info
    if (size == null || !Number.isFinite(size) || size < 0) return
    this.#sizeElement.textContent = formatFileSize(size)
  }
}

/**
 * Render a claimed file link or wiki embed (the `mdFile` mark) as an inline
 * pill: a file-kind icon, the file name, and the size once
 * `resolveFileInfo` supplies it. The pill never loads the file's content;
 * clicks are reported through `defineFileClickHandler`.
 */
export function defineFileView(options: FileViewOptions = {}): PlainExtension {
  return defineMarkView({
    name: 'mdFile' satisfies MarkName,
    constructor: (mark) => new FileMarkView(mark, options),
  }) as PlainExtension
}
