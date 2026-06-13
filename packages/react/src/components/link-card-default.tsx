import type { MouseEvent } from 'react'

import styles from './link-hover-card.module.css'

export interface LinkCardDefaultProps {
  kind: 'link' | 'wikilink'
  /** The URL, shown for Markdown links. */
  href?: string
  /** Place the caret in the link to edit its text. */
  onEdit: () => void
  /** Copy the URL. Markdown links only. */
  onCopy?: () => void
  /** Follow the link. Omitted when there is nothing to open. */
  onOpen?: (event: MouseEvent) => void
}

/** The built-in hover card shown when a host hover handler returns nothing. */
export function LinkCardDefault({ kind, href, onEdit, onCopy, onOpen }: LinkCardDefaultProps) {
  return (
    <div className={styles.Default}>
      {kind === 'link' && href ? (
        <span className={styles.Url} title={href}>
          {href}
        </span>
      ) : null}
      <button type="button" className={styles.Action} data-testid="link-card-edit" onClick={onEdit}>
        Edit
      </button>
      {onCopy ? (
        <button
          type="button"
          className={styles.Action}
          data-testid="link-card-copy"
          onClick={onCopy}
        >
          Copy
        </button>
      ) : null}
      {onOpen ? (
        <button
          type="button"
          className={styles.Action}
          data-testid="link-card-open"
          onClick={onOpen}
        >
          Open
        </button>
      ) : null}
    </div>
  )
}
