import { DropIndicator as ProseKitDropIndicator } from '@prosekit/react/drop-indicator'
import type { ReactElement } from 'react'

import styles from './drop-indicator.module.css'

export function DropIndicator(): ReactElement {
  return <ProseKitDropIndicator className={styles.DropIndicator} data-testid="drop-indicator" />
}
