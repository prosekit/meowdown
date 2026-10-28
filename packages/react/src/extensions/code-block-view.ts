import { defineCodeBlockPreviewPlugin } from '@meowdown/core'
import { union, type Extension } from '@prosekit/core'
import { defineReactNodeView, type ReactNodeViewComponent } from '@prosekit/react'

import { CodeBlockView } from '../components/code-block-view.tsx'

export function defineCodeBlockView(component: ReactNodeViewComponent = CodeBlockView): Extension {
  return union(
    defineReactNodeView({
      name: 'codeBlock',
      as: createCodeBlockRoot,
      contentAs: 'code',
      component,
    }),
    // Decorates the code block under the caret; `CodeBlockView` reads it to
    // decide whether the preview shows alone or below the source.
    defineCodeBlockPreviewPlugin(),
  )
}

function createCodeBlockRoot(): HTMLElement {
  const element = document.createElement('div')
  element.dataset.codeBlock = ''
  return element
}
