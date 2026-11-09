import type { ReactElement } from 'react'

import { getIconClass, ICON_CLASS, type IconName } from '../class-names.ts'

/**
 * A decorative Lucide icon, drawn in `currentColor` by the core stylesheet.
 */
export function Icon({ name }: { name: IconName }): ReactElement {
  return <span className={`${ICON_CLASS} ${getIconClass(name)}`} aria-hidden="true" />
}
