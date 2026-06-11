export interface EditorHandle {
  /**
   * Serializes the current document to Markdown. Can be expensive on large
   * documents; call it on demand (e.g. throttled) instead of on every change.
   */
  getMarkdown: () => string
}

/**
 * Searches tags for the tag menu. Receives the query typed after `#`
 * (lowercased, punctuation stripped) and returns the tags to show, either
 * synchronously or as a promise.
 */
export type TagSearchHandler = (query: string) => string[] | Promise<string[]>

/**
 * Searches notes for the wikilink menu. Receives the query typed after
 * `[[` (lowercased, punctuation stripped, may be empty or contain spaces)
 * and returns the note names to show, either synchronously or as a promise.
 */
export type WikilinkSearchHandler = (query: string) => string[] | Promise<string[]>
