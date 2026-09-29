import type { ReactElement } from 'react'

import { MarkdownView, type MarkdownViewProps } from './markdown-view.tsx'

export type MarkdownInlineViewProps = Omit<
  MarkdownViewProps,
  'inline' | 'frontmatter' | 'onTaskClick'
>

/**
 * Render paragraph content using the shared inline marks and link handlers.
 */
export function MarkdownInlineView(props: MarkdownInlineViewProps): ReactElement {
  return <MarkdownView {...props} inline />
}
