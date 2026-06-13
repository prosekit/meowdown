import { defineKeymap } from '@prosekit/core'
import { useExtension } from '@prosekit/react'
import {
  InlinePopoverPopup,
  InlinePopoverPositioner,
  InlinePopoverRoot,
} from '@prosekit/react/inline-popover'
import { useCallback, useMemo, useState } from 'react'

import styles from './ai-panel.module.css'

export interface AIPanelProps {}

export function AIPanel(props: AIPanelProps) {
  const [open, setOpen] = useState<boolean>(false)

  useExtension(
    useMemo(() => {
      return defineKeymap({
        'mod-j': () => {
          setOpen((open) => !open)
          return true
        },
      })
    }, []),
  )

  return (
    <InlinePopoverRoot
      className={styles.Root}
      defaultOpen={false}
      open={open}
      onOpenChange={useCallback((event) => {
        setOpen(event.detail)
      }, [])}
    >
      <InlinePopoverPositioner className={styles.Positioner}>
        <InlinePopoverPopup className={styles.Popup}>HELLO</InlinePopoverPopup>
      </InlinePopoverPositioner>
    </InlinePopoverRoot>
  )
}
