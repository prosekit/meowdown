import { DropIndicator as ProseKitDropIndicator } from '@prosekit/react/drop-indicator'

import styles from './drop-indicator.module.css'

export function DropIndicator() {
  return <ProseKitDropIndicator className={styles.DropIndicator} data-testid="drop-indicator" />
}
