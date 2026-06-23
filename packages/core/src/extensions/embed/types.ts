/**
 * Maps a markdown image `src` to an embed descriptor, or `undefined` if it does
 * not recognize the URL. The first matcher to return a descriptor wins; an
 * unmatched src falls back to plain `<img>` rendering.
 */
export type EmbedMatcher = (src: string) => EmbedDescriptor | undefined

/**
 * A framework-agnostic description of an embed iframe. Both the editor's DOM
 * mark view and the static React renderer build their own `<iframe>` from it, so
 * the URL/attribute logic lives in one place while each side renders natively.
 */
export interface EmbedDescriptor {
  readonly kind: 'tweet' | 'youtube'
  /**
   * Stable identity for the widget, unique per rendered embed (e.g. the video or
   * tweet id). Keeps ProseMirror from rebuilding the iframe on every edit, and
   * keys the React element, so the embed never reloads.
   */
  readonly key: string
  /** The iframe `src`. */
  readonly src: string
  /** The iframe `title`. */
  readonly title: string
  /** The iframe `class`, e.g. `md-embed md-embed-tweet`. */
  readonly className: string
  /** The iframe `data-testid`. */
  readonly testid: string
  /** The iframe `allow` policy, when the embed needs one. */
  readonly allow?: string
  /** Whether the iframe is fullscreen-capable. */
  readonly allowFullscreen?: boolean
}
