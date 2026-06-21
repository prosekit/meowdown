import {
  BlockHandleDraggable,
  BlockHandlePopup,
  BlockHandlePositioner,
  BlockHandleRoot,
} from '@prosekit/react/block-handle'
import { GripVerticalIcon } from 'lucide-react'

import styles from './block-handle.module.css'

export function BlockHandle() {
  return (
    <BlockHandleRoot>
      <BlockHandlePositioner className={styles.Positioner}>
        <BlockHandlePopup className={styles.Popup} data-testid="block-handle">
          <BlockHandleDraggable className={styles.Draggable} data-testid="block-handle-drag">
            <GripVerticalIcon />
          </BlockHandleDraggable>
        </BlockHandlePopup>
      </BlockHandlePositioner>
    </BlockHandleRoot>
  )
}
