import { defineCodeBlockPreviewPlugin } from '@meowdown/core'
import { union, type Extension } from '@prosekit/core'
import { defineReactNodeView, type ReactNodeViewComponent } from '@prosekit/react'
import { createElement } from 'react'

import {
  CodeBlockView,
  type CodeBlockRenderer,
  type CodeBlockViewProps,
} from '../components/code-block-view.tsx'

export function defineCodeBlockView(renderCodeBlock?: CodeBlockRenderer): Extension {
  const component: ReactNodeViewComponent = (props) => {
    return createElement(CodeBlockView, {
      ...props,
      renderCodeBlock,
    } satisfies CodeBlockViewProps)
  }

  return union(
    defineReactNodeView({
      name: 'codeBlock',
      contentAs: 'code',
      component,
    }),
    // Decorates the code block under the caret; `CodeBlockView` reads it to
    // decide whether the preview shows alone or below the source.
    defineCodeBlockPreviewPlugin(),
  )
}
