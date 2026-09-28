/**
 * A block tree whose inline values contain literal Markdown, including marks.
 */
export interface MarkdownDocument {
  type: 'document'
  /**
   * YAML body without fences. Undefined means absent; an empty string is an empty block.
   */
  frontmatter?: string
  children: MarkdownBlock[]
}

/**
 * Raw inline Markdown. Changing `value` invalidates an adapter's recorded segments.
 */
export interface MarkdownInline {
  value: string
  /**
   * Optional editor text boundaries. Undefined chunks are non-text inline nodes,
   * which emit no text but can prevent an empty block or an HTML continuation.
   * Used only while `value` equals the recorded value; parsers need not supply it.
   */
  segments?: {
    value: string
    chunks: Array<string | undefined>
    /**
     * Descendant text, including inline atoms, for table cell serialization.
     */
    textContent?: string
  }
}

export interface MarkdownParagraph extends MarkdownInline {
  type: 'paragraph'
}

export interface MarkdownHeading extends MarkdownInline {
  type: 'heading'
  level: number
  /**
   * Length of the setext underline; absent for ATX headings.
   */
  setextUnderline?: number
  /**
   * Number of optional closing ATX hashes.
   */
  closingHashes?: number
}

export interface MarkdownBlockquote {
  type: 'blockquote'
  children: MarkdownBlock[]
}

/**
 * One item, not a list wrapper. Adjacent items form a run; nested items are children.
 * For `+   [X] **buy**`, kind is task, marker is '+', markerGap is 3,
 * checked is true, taskMarker is 'X', and the first paragraph's value is '**buy**'.
 */
export interface MarkdownListItem {
  type: 'listItem'
  kind: 'bullet' | 'ordered' | 'task'
  /**
   * Number of an ordered item, defaulting to 1.
   */
  order?: number
  checked: boolean
  /**
   * A folded bullet emits '+'. Task folding is not persisted.
   */
  collapsed: boolean
  marker?: '.' | ')' | '-' | '*' | '+'
  taskMarker?: 'x' | 'X'
  /**
   * Spaces after the list marker, clamped to 1–4 when serialized.
   */
  markerGap?: number
  children: MarkdownBlock[]
}

export interface MarkdownCodeBlock {
  type: 'codeBlock'
  value: string
  language: string
  /**
   * Absent means backticks. Dollar fences require language 'math'.
   */
  fenceStyle?: 'tilde' | 'indented' | 'dollar'
  /**
   * Minimum opening fence width; content can require a wider fence.
   */
  fenceLength?: number
}

export interface MarkdownHorizontalRule {
  type: 'horizontalRule'
  /**
   * Original spelling, defaulting to '---'.
   */
  marker?: string
}

export interface MarkdownHTMLComment {
  type: 'htmlComment'
  /**
   * Includes the comment delimiters.
   */
  value: string
}

export interface MarkdownTable {
  type: 'table'
  children: MarkdownTableRow[]
}

export interface MarkdownTableRow {
  type: 'tableRow'
  children: MarkdownTableCell[]
}

export interface MarkdownTableCell {
  type: 'tableCell'
  header: boolean
  align?: 'left' | 'center' | 'right'
  children: MarkdownBlock[]
}

/**
 * An unsupported editor block: omitted from output, but separates list runs.
 */
export interface MarkdownIgnored {
  type: 'ignored'
  /**
   * Descendant text, used if the node occurs inside a table cell.
   */
  value: string
  /**
   * Whether the original node contains children.
   */
  hasContent: boolean
}

/**
 * A standalone editor text node. Block parsers never produce this type.
 */
export interface MarkdownText {
  type: 'text'
  value: string
}

export type MarkdownBlock =
  | MarkdownParagraph
  | MarkdownHeading
  | MarkdownBlockquote
  | MarkdownListItem
  | MarkdownCodeBlock
  | MarkdownHorizontalRule
  | MarkdownHTMLComment
  | MarkdownTable
  | MarkdownIgnored
  | MarkdownText

export type MarkdownNode = MarkdownDocument | MarkdownBlock | MarkdownTableRow | MarkdownTableCell
