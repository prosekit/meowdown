/**
 * Metadata a host application can supply for a web link.
 */
export interface LinkPreview {
  readonly title: string
  readonly description?: string
  readonly iconSrc?: string
}

/**
 * Resolve display metadata for a link, or return `undefined` when unavailable.
 * Deliberately signal-free to keep the API simple: callers drop stale results
 * instead of cancelling in-flight work.
 */
export type LinkPreviewResolver = (
  href: string,
) => LinkPreview | undefined | Promise<LinkPreview | undefined>
