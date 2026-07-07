/**
 * The one thing `DemoEditor` asks of a mounted pane: its current Markdown,
 * read when the mode flips to seed the next pane.
 */
export interface MarkdownSource {
  getMarkdown: () => string
}
