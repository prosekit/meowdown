import { getHTMLBlockKind, isCodeBlockPreviewHiddenDecoration } from '@meowdown/core'
import { isApple } from '@prosekit/core'
import { TextSelection } from '@prosekit/pm/state'
import type { ReactNodeViewProps } from '@prosekit/react'
import { useMemo, type MouseEvent } from 'react'

import { htmlBlockHasVisiblePreview, HTMLBlockRender } from './html-block-render.tsx'
import styles from './html-block-view.module.css'

// Interactive preview content that should respond to a plain click instead of
// dropping the caret into the source.
const INTERACTIVE_SELECTOR = 'details, summary, video, audio'

/**
 * Node view for a raw HTML block: the editable source stacked with a live,
 * sanitized preview. With the caret outside, an element block shows only its
 * preview; move the caret in and the source appears above it (the MarkText
 * "stacked" model, matching the math block). Comments, processing instructions,
 * and script/style metadata render nothing, so they always stay source-only.
 */
export function HTMLBlockView(props: ReactNodeViewProps & { renderPreview: boolean }) {
  const { renderPreview } = props
  const source = props.node.textContent
  const kind = getHTMLBlockKind(source)

  const caretInside = props.decorations.some(isCodeBlockPreviewHiddenDecoration)

  // Only an element block can render; a comment/PI/metadata block never gets a
  // preview, and an element that sanitizes to nothing keeps its source visible.
  const hasPreview = useMemo(
    () => renderPreview && kind === 'element' && htmlBlockHasVisiblePreview(source),
    [renderPreview, kind, source],
  )

  const previewOnly = hasPreview && !caretInside

  const focusSource = () => {
    const pos = props.getPos()
    if (pos == null) return
    const { view } = props
    const selection = TextSelection.near(view.state.doc.resolve(pos + 1), 1)
    view.dispatch(view.state.tr.setSelection(selection))
    view.focus()
  }

  const onPreviewMouseDown = (event: MouseEvent) => {
    const forceEdit = isApple ? event.metaKey : event.ctrlKey
    // Let interactive widgets (a `<details>` toggle, a video control) handle a
    // plain click; `Mod`-click always forces editing.
    if (!forceEdit && (event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) {
      return
    }
    event.preventDefault()
    focusSource()
  }

  return (
    <div className={styles.Root} data-preview={previewOnly || undefined} data-kind={kind}>
      <pre ref={props.contentRef} data-html-block data-testid="html-block-source"></pre>
      {hasPreview && (
        <HTMLBlockRender
          source={source}
          className={styles.Preview}
          data-testid="html-block-preview"
          onMouseDown={onPreviewMouseDown}
        />
      )}
    </div>
  )
}
