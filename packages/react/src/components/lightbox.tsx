import { clsx } from 'clsx/lite'
import { XIcon } from 'lucide-react'
import { ViewTransition, type ReactNode } from 'react'

import { useDismissDrag, type DismissReason } from '../hooks/use-dismiss-drag.ts'
import {
  LIGHTBOX_TRANSITION_NAME,
  type LightboxController,
  type LightboxItem,
} from '../hooks/use-lightbox.ts'

import styles from './lightbox.module.css'

/**
 * Props for {@link Lightbox}.
 */
export interface LightboxProps {
  /**
   * From {@link useLightbox}.
   */
  readonly lightbox: LightboxController
  /**
   * The touch layout: a solid black background, a close button in the top
   * corner, and drag or flick the content away to dismiss. Off by default.
   */
  readonly touch?: boolean
  /**
   * Extra controls for the top end corner, such as an "Open" button.
   */
  readonly renderActions?: (item: LightboxItem) => ReactNode
  /**
   * Optional class applied to the full-window popup, after the default one.
   */
  readonly className?: string
}

/**
 * A full-window preview of one image. Click or tap anywhere, or press
 * `Escape`, to close it.
 */
export function Lightbox({
  lightbox,
  touch = false,
  renderActions,
  className,
}: LightboxProps): ReactNode {
  const { item, close } = lightbox
  const dismissDrag = useDismissDrag({
    active: item != null,
    enabled: touch,
    onClose: (reason: DismissReason) => close({ instant: reason === 'drag' }),
  })

  if (!item) return null

  const actions = renderActions?.(item)

  return (
    <ViewTransition>
      <dialog
        ref={showModal}
        aria-label="Image preview"
        className={clsx(styles.Dialog, className)}
        data-touch={touch ? '' : undefined}
        data-testid="lightbox"
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
        onClose={() => close({ instant: true })}
      >
        {touch ? (
          <div aria-hidden className={styles.TouchBackdrop} style={dismissDrag.backdropStyle} />
        ) : null}
        {touch ? (
          <div className={styles.Corner} data-side="start" style={dismissDrag.chromeStyle}>
            <button
              type="button"
              aria-label="Close"
              className={styles.CloseButton}
              onClick={() => close()}
            >
              <XIcon />
            </button>
          </div>
        ) : null}
        {actions != null ? (
          <div className={styles.Corner} data-side="end" style={dismissDrag.chromeStyle}>
            {actions}
          </div>
        ) : null}
        <button
          type="button"
          aria-label="Close image preview"
          className={styles.Content}
          {...dismissDrag.handlers}
        >
          <img
            src={item.src}
            alt={item.alt ?? ''}
            draggable={false}
            className={styles.Image}
            onTransitionEnd={dismissDrag.finishSettle}
            style={{ ...dismissDrag.imageStyle, viewTransitionName: LIGHTBOX_TRANSITION_NAME }}
          />
        </button>
      </dialog>
    </ViewTransition>
  )
}

function showModal(dialog: HTMLDialogElement | null): void {
  if (dialog && !dialog.open) dialog.showModal()
}
