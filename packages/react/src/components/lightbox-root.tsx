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
   * Render the open item. Put a {@link LightboxImage} somewhere inside, along
   * with whatever closes the lightbox.
   */
  readonly children: (item: LightboxItem) => ReactNode
}

function showModal(dialog: HTMLDialogElement | null): void {
  if (dialog && !dialog.open) dialog.showModal()
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
  const { item, close } = lightbox
  if (!item) return null

  return (
    <ViewTransition>
      <dialog
        aria-label="Image preview" // FIXME: is this correct?
        {...props}
        ref={showModal}
        className={clsx(styles.Dialog, className)}
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
        onClose={() => close({ instant: true })}
      >
        {children(item)}
      </dialog>
    </ViewTransition>
  )
}
