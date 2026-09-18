import type { PlaceholderOptions } from '@prosekit/extensions/placeholder'

import type { ExitBoundaryHandler } from './exit-boundary.ts'
import type { FilePasteOptions } from './file-paste.ts'
import type { FileViewOptions } from './file-view.ts'
import type { FollowLinkHandlers } from './follow-link.ts'
import type { ImageOptions } from './image.ts'
import type { InlineMarkOptions } from './inline-text-to-mark-chunks.ts'
import type { MarkMode } from './mark-mode.ts'
import type { XPostMediaClickHandler } from './x-post-media-click.ts'

export interface EditorConfig
  extends InlineMarkOptions, FollowLinkHandlers, FilePasteOptions, FileViewOptions, ImageOptions {
  markMode?: MarkMode
  onExitBoundary?: ExitBoundaryHandler
  onXPostMediaClick?: XPostMediaClickHandler
  embedPaste?: boolean
  linkPaste?: boolean
  bulletAfterHeading?: boolean
  substitution?: boolean
  wikilinkEnabled?: boolean
  placeholder?: PlaceholderOptions['placeholder']
  readOnly?: boolean
  spellCheck?: boolean
  editorClassName?: string
}
