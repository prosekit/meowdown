import { Menu } from '@base-ui/react/menu'
import { use, type ReactElement, type ReactNode } from 'react'

import {
  MENU_ITEM_CLASS,
  MENU_POPUP_CLASS,
  MENU_POSITIONER_CLASS,
  type IconName,
} from '../class-names.ts'

import { CollisionBoundaryContext } from './collision-boundary.ts'
import { Icon } from './icon.tsx'

export interface ActionMenuPopupProps {
  /**
   * The element to position the menu against, when it is not the menu's
   * `Menu.Trigger`.
   */
  anchor?: Element | undefined
  finalFocus: () => boolean
  testId?: string | undefined
  children: ReactNode
}

/**
 * The popup of an action menu, such as the code block menu or the embed
 * menu, placed below its trigger or `anchor`.
 */
export function ActionMenuPopup({
  anchor,
  finalFocus,
  testId,
  children,
}: ActionMenuPopupProps): ReactElement {
  const collisionBoundary = use(CollisionBoundaryContext)
  return (
    <Menu.Portal>
      <Menu.Positioner
        anchor={anchor}
        className={MENU_POSITIONER_CLASS}
        sideOffset={4}
        align="start"
        collisionBoundary={collisionBoundary}
      >
        <Menu.Popup className={MENU_POPUP_CLASS} finalFocus={finalFocus} data-testid={testId}>
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}

export interface ActionMenuItemProps {
  icon: IconName
  label: string
  onClick: VoidFunction
  testId: string
}

/**
 * A row of an action menu: an icon and a label.
 */
export function ActionMenuItem({
  icon,
  label,
  onClick,
  testId,
}: ActionMenuItemProps): ReactElement {
  return (
    <Menu.Item className={MENU_ITEM_CLASS} onClick={onClick} data-testid={testId}>
      <Icon name={icon} />
      <span>{label}</span>
    </Menu.Item>
  )
}
