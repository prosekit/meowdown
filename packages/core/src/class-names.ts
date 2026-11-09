// All class names used in the editor should be defined here to avoid typos and make it easier to change them in the future.

/**
 * The root of an atom mark view: an image, file, or wiki link.
 */
export const ATOM_VIEW_CLASS = 'md-atom-view'

/**
 * The hidden holder of an atom mark view's Markdown source.
 */
export const ATOM_VIEW_CONTENT_CLASS = 'md-atom-view-content'

/**
 * The rendered, non-editable part of an atom mark view.
 */
export const ATOM_VIEW_PREVIEW_CLASS = 'md-atom-view-preview'

/**
 * The root of an image mark view, which also renders X post and YouTube cards.
 */
export const IMAGE_VIEW_CLASS = 'md-image-view'

/**
 * The hidden holder of an image's Markdown source.
 */
export const IMAGE_VIEW_CONTENT_CLASS = 'md-image-view-content'

/**
 * The rendered image or card.
 */
export const IMAGE_VIEW_PREVIEW_CLASS = 'md-image-view-preview'

/**
 * The drag handle that resizes an image or YouTube card.
 */
export const IMAGE_RESIZE_HANDLE_CLASS = 'md-image-resize-handle'

/**
 * The class of the menu button that an image, X post, or YouTube card shows
 * in the editor.
 */
export const EMBED_MENU_BUTTON_CLASS = 'md-embed-menu-button'

/**
 * A small square button holding one icon.
 */
export const ICON_BUTTON_CLASS = 'meowdown-icon-button'

/**
 * A Lucide icon drawn in `currentColor`. Pair it with {@link getIconClass}.
 */
export const ICON_CLASS = 'meowdown-icon'

/**
 * The Lucide icons that the core stylesheet ships.
 */
export type IconName =
  | 'braces'
  | 'check'
  | 'chevrons-up-down'
  | 'copy'
  | 'earth'
  | 'ellipsis'
  | 'grip-horizontal'
  | 'grip-vertical'
  | 'link-2'
  | 'pencil'
  | 'sparkles'
  | 'trash-2'
  | 'unlink'

/**
 * The class that picks the icon `name`, used together with {@link ICON_CLASS}.
 */
export function getIconClass(name: IconName): string {
  return `${ICON_CLASS}-${name}`
}

/**
 * The positioner of a floating action menu.
 */
export const MENU_POSITIONER_CLASS = 'meowdown-menu-positioner'

/**
 * The popup of a floating action menu.
 */
export const MENU_POPUP_CLASS = 'meowdown-menu-popup'

/**
 * A row of a floating menu.
 */
export const MENU_ITEM_CLASS = 'meowdown-menu-item'

/**
 * The check mark of the chosen row in a pick list.
 */
export const MENU_ITEM_INDICATOR_CLASS = 'meowdown-menu-item-indicator'
