import {
  BlockHandleAdd,
  BlockHandleDraggable,
  BlockHandlePopup,
  BlockHandlePositioner,
  BlockHandleRoot,
} from '@prosekit/react/block-handle'

import { GripVerticalIcon } from './icons/grip-vertical-icon.tsx'
import { PlusIcon } from './icons/plus-icon.tsx'

export function BlockHandle() {
  return (
    <BlockHandleRoot>
      <BlockHandlePositioner className="meowdown-block-handle-positioner">
        <BlockHandlePopup className="meowdown-block-handle" data-testid="block-handle">
          <BlockHandleAdd className="meowdown-block-handle-add" data-testid="block-handle-add">
            <PlusIcon />
          </BlockHandleAdd>
          <BlockHandleDraggable
            className="meowdown-block-handle-drag"
            data-testid="block-handle-drag"
          >
            <GripVerticalIcon />
          </BlockHandleDraggable>
        </BlockHandlePopup>
      </BlockHandlePositioner>
    </BlockHandleRoot>
  )
}
