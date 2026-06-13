import {
  BlockHandleAdd,
  BlockHandleDraggable,
  BlockHandlePopup,
  BlockHandlePositioner,
  BlockHandleRoot,
} from '@prosekit/react/block-handle'

import styles from './block-handle.module.css'
import { GripVerticalIcon } from './icons/grip-vertical-icon.tsx'
import { PlusIcon } from './icons/plus-icon.tsx'

export function BlockHandle() {
  return (
    <BlockHandleRoot>
      <BlockHandlePositioner className={styles.Positioner}>
        <BlockHandlePopup className={styles.Popup} data-testid="block-handle">
          <BlockHandleAdd className={styles.Add} data-testid="block-handle-add">
            <PlusIcon />
          </BlockHandleAdd>
          <BlockHandleDraggable className={styles.Draggable} data-testid="block-handle-drag">
            <GripVerticalIcon />
          </BlockHandleDraggable>
        </BlockHandlePopup>
      </BlockHandlePositioner>
    </BlockHandleRoot>
  )
}
