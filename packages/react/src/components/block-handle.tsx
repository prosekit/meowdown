import {
  BlockHandleDraggable,
  BlockHandlePopup,
  BlockHandlePositioner,
  BlockHandleRoot,
} from '@prosekit/react/block-handle'
import type { ReactElement } from 'react'

import styles from './block-handle.module.css'
import { Icon } from './icon.tsx'

export function BlockHandle(): ReactElement {
  return (
    <BlockHandleRoot>
      <BlockHandlePositioner className={styles.Positioner}>
        <BlockHandlePopup className={styles.Popup} data-testid="block-handle">
          <BlockHandleDraggable className={styles.Draggable} data-testid="block-handle-drag">
            <Icon name="grip-vertical" />
          </BlockHandleDraggable>
        </BlockHandlePopup>
      </BlockHandlePositioner>
    </BlockHandleRoot>
  )
}
