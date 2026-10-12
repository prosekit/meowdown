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
  spellCheck?: boolean | undefined
  editorClassName?: string | undefined
}
