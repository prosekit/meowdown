import type { Extension } from '@prosekit/core'
import {
  defineReactNodeView,
  type ReactNodeViewComponent,
  type ReactNodeViewProps,
} from '@prosekit/react'

import { HTMLBlockView } from '../components/html-block-view.tsx'

/**
 * Renders `htmlBlock` nodes with the stacked source + sanitized preview node
 * view. `renderPreview` (the editor's `renderHTMLPreview` prop) is read once at
 * editor creation; when false, every block stays source-only. The caret-inside
 * decoration comes from `defineCodeBlockPreviewPlugin`, already applied by
 * `defineCodeBlockView`.
 */
export function defineHTMLBlockView(options: { renderPreview: boolean }): Extension {
  const component = (props: ReactNodeViewProps) => (
    <HTMLBlockView {...props} renderPreview={options.renderPreview} />
  )
  return defineReactNodeView({
    name: 'htmlBlock',
    contentAs: 'code',
    component: component satisfies ReactNodeViewComponent,
  })
}
