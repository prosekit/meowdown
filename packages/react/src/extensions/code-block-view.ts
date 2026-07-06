import { union, type Extension } from '@prosekit/core'
import { defineCodeBlockPreviewPlugin } from '@prosekit/extensions/code-block'
import { defineReactNodeView, type ReactNodeViewComponent } from '@prosekit/react'

import { CodeBlockView } from '../components/code-block-view.tsx'

export function defineCodeBlockView(): Extension {
  return union(
    defineReactNodeView({
      name: 'codeBlock',
      contentAs: 'code',
      component: CodeBlockView satisfies ReactNodeViewComponent,
    }),
    // Decorates the code block under the caret; `CodeBlockView` reads it to
    // decide whether the math preview shows alone or below the source.
    defineCodeBlockPreviewPlugin(),
  )
}
