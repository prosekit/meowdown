import type { PlaceholderOptions } from '@prosekit/extensions/placeholder'

import type { ExitBoundaryHandler } from './exit-boundary.ts'
import type { FilePasteOptions } from './file-paste.ts'
import type { FileViewOptions } from './file-view.ts'
import type { FollowLinkHandlers } from './follow-link.ts'
import type { ImageOptions } from './image.ts'
import type { InlineMarkOptions } from './inline-text-to-mark-chunks.ts'
import type { MarkMode } from './mark-mode.ts'
import type { XPostMediaClickHandler } from './x-post-media-click.ts'
import type { YouTubeVideoClickHandler } from './youtube-video-click.ts'

export interface EditorConfig
  extends InlineMarkOptions, FollowLinkHandlers, FilePasteOptions, FileViewOptions, ImageOptions {
  markMode?: MarkMode | undefined
  onExitBoundary?: ExitBoundaryHandler | undefined
  onXPostMediaClick?: XPostMediaClickHandler | undefined
  onYouTubeVideoClick?: YouTubeVideoClickHandler | undefined
  embedPaste?: boolean | undefined
  linkPaste?: boolean | undefined
  bulletAfterHeading?: boolean | undefined
  backspaceDeletesEmptyFirstBlock?: boolean | undefined
  substitution?: boolean | undefined
  /**
   * Keep the document to one paragraph of inline Markdown: typed block
   * prefixes (`# `, `> `, `- `, ```` ``` ````) stay literal and pasted blocks
   * flatten into soft lines. Seed the editor with `paragraphMarkdownToDoc` and
   * read it with `docToParagraphMarkdown`.
   */
  singleParagraph?: boolean | undefined
  wikilinkEnabled?: boolean | undefined
  placeholder?: PlaceholderOptions['placeholder'] | undefined
  readOnly?: boolean | undefined
  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/spellcheck
   */
  spellCheck?: boolean | undefined
  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/writingsuggestions
   */
  writingSuggestions?: boolean | undefined
  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/autocorrect
   */
  autoCorrect?: boolean | undefined
  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/autocapitalize
   */
  autoCapitalize?: 'off' | 'sentences' | 'words' | 'characters' | undefined
  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/enterkeyhint
   */
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send' | undefined
  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/dir
   */
  dir?: 'ltr' | 'rtl' | 'auto' | undefined
  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang
   */
  lang?: string | undefined
  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label
   */
  ariaLabel?: string | undefined
  editorClassName?: string | undefined
}
