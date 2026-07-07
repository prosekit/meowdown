import { MarkdownView, type MarkdownViewProps } from '@meowdown/react'
import { useImperativeHandle, type Ref } from 'react'

import type { MarkdownSource } from './markdown-source.ts'

export interface ReadonlyViewProps extends MarkdownViewProps {
  /** Reports the rendered Markdown text back to the mode-flip seeding. */
  ref?: Ref<MarkdownSource>
}

export function ReadonlyView({ markdown, ref, ...viewProps }: ReadonlyViewProps) {
  useImperativeHandle(ref, () => ({ getMarkdown: () => markdown }), [markdown])
  return (
    <div className="meowdown">
      <MarkdownView markdown={markdown} {...viewProps} />
    </div>
  )
}
