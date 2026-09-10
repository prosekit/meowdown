import { defineCodeBlockPreviewPlugin } from '@meowdown/core'
import { union, type Extension } from '@prosekit/core'
import { defineReactNodeView, type ReactNodeViewComponent } from '@prosekit/react'

import { CodeBlockView } from '../components/code-block-view.tsx'

export function defineCodeBlockView(
  component: ReactNodeViewComponent | false = CodeBlockView,
): Extension {
  // Decorates the code block under the caret; `CodeBlockView` reads it to
  // decide whether the preview shows alone or below the source.
  const preview = defineCodeBlockPreviewPlugin()
  if (!component) return preview
  return union(
    defineReactNodeView({
      name: 'codeBlock',
      contentAs: 'code',
      component,
    }),
    preview,
  )
}
