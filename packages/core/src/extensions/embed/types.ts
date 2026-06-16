/**
 * Maps a markdown image `src` to an embed renderer, or `undefined` if it does
 * not recognize the URL. The first matcher to return a renderer wins; an
 * unmatched src falls back to plain `<img>` rendering.
 */
export type EmbedMatcher = (src: string) => EmbedRender | undefined

export interface EmbedRender {
  /**
   * Stable identity for the widget DOM, unique per rendered embed (e.g. the
   * video or tweet id). Keeps ProseMirror from rebuilding the iframe on every
   * edit, so the embed never reloads.
   */
  readonly key: string
  /** Build the embed element. Called once per unique key. */
  render: () => HTMLElement
}
