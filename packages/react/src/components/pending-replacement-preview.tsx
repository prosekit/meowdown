import { Popover } from '@base-ui/react/popover'
import {
  definePendingReplacementHandler,
  getVirtualElementFromRange,
  type EditorExtension,
  type PendingReplacement,
  type VirtualElement,
} from '@meowdown/core'
import { useEditor, useExtension } from '@prosekit/react'
import { useMemo, useState, type ReactNode } from 'react'

import styles from './pending-replacement-preview.module.css'
import type { PendingReplacementResolveHandler } from './types.ts'

interface PendingReplacementPreviewProps {
  /** Extra controls rendered in the preview footer (e.g. a retry button). */
  actions?: ReactNode
  /** Called when the stage ends, with the outcome and the final staged value. */
  onResolve?: PendingReplacementResolveHandler
}

/**
 * The preview for a staged (pending) replacement: a popover anchored to the
 * source range showing the accumulated text, with Accept and Discard controls
 * plus a host-provided `actions` slot. Dismissing the popover (Escape or an
 * outside press) discards the stage; the document is only touched on accept.
 */
export function PendingReplacementPreview({ actions, onResolve }: PendingReplacementPreviewProps) {
  const editor = useEditor<EditorExtension>()
  const [pending, setPending] = useState<PendingReplacement | null>(null)

  useExtension(
    useMemo(() => {
      return definePendingReplacementHandler((event) => {
        if (event.type === 'update') {
          setPending(event.pending)
        } else {
          setPending(null)
          onResolve?.(event.outcome, event.pending)
        }
      })
    }, [onResolve]),
  )

  const from = pending?.from
  const to = pending?.to
  const anchor: VirtualElement | undefined = useMemo(() => {
    if (from == null || to == null) return
    return getVirtualElementFromRange(editor.view, { from, to })
  }, [from, to, editor])

  if (!pending) return null

  const discard = (): void => {
    editor.commands.discardPendingReplacement()
    editor.focus()
  }
  const accept = (): void => {
    editor.commands.acceptPendingReplacement()
    editor.focus()
  }

  return (
    <Popover.Root
      open
      onOpenChange={(next) => {
        if (!next) discard()
      }}
    >
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          side="bottom"
          sideOffset={8}
          className={styles.Positioner}
        >
          <Popover.Popup
            className={styles.Popup}
            data-testid="pending-replacement"
            initialFocus={false}
            finalFocus={false}
          >
            <div className={styles.Text} data-testid="pending-replacement-text">
              {pending.text || <span className={styles.Waiting}>Waiting for text...</span>}
            </div>
            <div className={styles.Footer}>
              {actions}
              <span className={styles.Spacer} />
              <button
                type="button"
                className={styles.Button}
                data-testid="pending-replacement-discard"
                onClick={discard}
              >
                Discard
              </button>
              <button
                type="button"
                className={styles.AcceptButton}
                data-testid="pending-replacement-accept"
                disabled={!pending.text.trim()}
                onClick={accept}
              >
                Accept
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
