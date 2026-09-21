import { clsx } from 'clsx/lite'
import { ViewTransition, type ComponentProps, type ReactNode } from 'react'

import type { LightboxController, LightboxItem } from '../hooks/use-lightbox.ts'

import styles from './lightbox.module.css'

/**
 * Props for {@link LightboxRoot}. Other props land on the `<dialog>`.
 */
export interface LightboxRootProps extends Omit<
  ComponentProps<'dialog'>,
  'children' | 'ref' | 'open' | 'onCancel' | 'onClose'
> {
  /**
   * From {@link useLightbox}.
   */
  readonly lightbox: LightboxController
  /**
   * Render the open item. Put a {@link LightboxImage}, {@link LightboxVideo}, or {@link LightboxFrame} somewhere inside, along
   * with whatever closes the lightbox.
   */
  readonly children: (item: LightboxItem) => ReactNode
}

const DIALOG_TRANSITION_CLASS = 'meowdown-lightbox-dialog'

function showModal(dialog: HTMLDialogElement) {
  // A closing dialog hands focus back, and WebKit scrolls a focused editor to
  // its caret, away from the thumbnail. An editor without focus is left alone.
  const active = document.activeElement
  if (active instanceof HTMLElement && active.isContentEditable) active.blur()
  dialog.showModal()
  return () => dialog.close()
}

/**
 * The full-window modal shell of a lightbox. It renders nothing while no item
 * is open, and `Escape` closes it.
 */
export function LightboxRoot({
  lightbox,
  children,
  className,
  ...props
}: LightboxRootProps): ReactNode {
  const { item, close, onExited } = lightbox
  if (!item) return null

  return (
    <ViewTransition default={DIALOG_TRANSITION_CLASS} onExit={() => onExited}>
      <dialog
        aria-label={item.type === 'image' ? 'Image preview' : 'Video preview'}
        {...props}
        ref={showModal}
        className={clsx(styles.Dialog, className)}
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
        onClose={(event) => {
          // StrictMode closes and reopens the dialog on mount, and that
          // close event arrives after it is open again.
          if (!event.currentTarget.open) close({ instant: true })
        }}
      >
        {children(item)}
      </dialog>
    </ViewTransition>
  )
}
