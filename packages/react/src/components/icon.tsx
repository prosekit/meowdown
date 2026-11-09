import type { ReactElement } from 'react'

/**
 * The Lucide icons that `@meowdown/core/style.css` ships as
 * `.meowdown-icon-{name}`.
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
 * A decorative Lucide icon, drawn in `currentColor` by the core stylesheet.
 */
export function Icon({ name }: { name: IconName }): ReactElement {
  return <span className={`meowdown-icon meowdown-icon-${name}`} aria-hidden="true" />
}
