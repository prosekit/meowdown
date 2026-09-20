import { clsx } from 'clsx/lite'
import type { ComponentProps, ReactNode } from 'react'

import { LIGHTBOX_TRANSITION_NAME, type LightboxItem } from '../hooks/use-lightbox.ts'

import styles from './lightbox.module.css'

/**
 * Props for {@link LightboxImage}. Other props land on the `<img>`.
 */
export interface LightboxImageProps extends Omit<ComponentProps<'img'>, 'src' | 'alt'> {
  readonly item: LightboxItem
}

/**
 * The image of a lightbox. It is the element the opened thumbnail zooms into.
 */
export function LightboxImage({ item, className, style, ...props }: LightboxImageProps): ReactNode {
  return (
    <img
      draggable={false}
      {...props}
      src={item.src}
      alt={item.alt ?? ''}
      className={clsx(styles.Image, className)}
      style={{ ...style, viewTransitionName: LIGHTBOX_TRANSITION_NAME }}
    />
  )
}
