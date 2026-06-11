export interface EditorHandle {
  /**
   * Serializes the current document to Markdown. Can be expensive on large
   * documents; call it on demand (e.g. throttled) instead of on every change.
   */
  getMarkdown: () => string
}
