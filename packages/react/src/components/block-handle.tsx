import {
  BlockHandleAdd,
  BlockHandleDraggable,
  BlockHandlePopup,
  BlockHandlePositioner,
  BlockHandleRoot,
} from '@prosekit/react/block-handle'

// lucide "plus" and "grip-vertical", inlined since the package has no icon
// dependency. Sized by the button CSS.
function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

function GripVerticalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="5" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="19" r="1" />
    </svg>
  )
}

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
