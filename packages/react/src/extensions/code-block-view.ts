import { defineCodeBlockPreviewPlugin } from '@meowdown/core'
import { union, type Extension } from '@prosekit/core'
import { defineReactNodeView, type ReactNodeViewComponent } from '@prosekit/react'
import { createElement, type ReactElement } from 'react'

import {
  CodeBlockView,
  type CodeBlockRenderer,
  type CodeBlockViewProps,
} from '../components/code-block-view.tsx'

/**
 * Build the built-in code block view, reading `renderCodeBlock` when the view
 * renders so a later callback does not recreate the editor.
 */
function codeBlockViewWithRenderer(
  renderCodeBlock: (() => CodeBlockRenderer | undefined) | undefined,
): ReactNodeViewComponent {
  return function CodeBlockNodeView(props): ReactElement {
    return createElement(CodeBlockView, {
      ...props,
      renderCodeBlock: renderCodeBlock?.(),
    } satisfies CodeBlockViewProps)
  }
}

/**
 * React node view for `codeBlock`. Pass `component` to replace the built-in
 * view. `renderCodeBlock` customizes the built-in view and is ignored when
 * `component` is set.
 */
export function defineCodeBlockView(
  component?: ReactNodeViewComponent,
  renderCodeBlock?: () => CodeBlockRenderer | undefined,
): Extension {
  return union(
    defineReactNodeView({
      name: 'codeBlock',
      contentAs: 'code',
      component: component ?? codeBlockViewWithRenderer(renderCodeBlock),
    }),
    // Decorates the code block under the caret; `CodeBlockView` reads it to
    // decide whether the preview shows alone or below the source.
    defineCodeBlockPreviewPlugin(),
  )
}
