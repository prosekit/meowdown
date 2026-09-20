import { clsx } from 'clsx/lite'
import type { ComponentProps, ReactNode } from 'react'

import { LIGHTBOX_MEDIA_CLASS, type LightboxImageItem } from '../hooks/use-lightbox.ts'

import styles from './lightbox.module.css'

/**
 * Props for {@link LightboxImage}. Other props land on the `<img>`.
 */
export interface LightboxImageProps extends Omit<ComponentProps<'img'>, 'src' | 'alt'> {
  readonly item: LightboxImageItem
}

/**
 * The image of a lightbox. It is the element the opened thumbnail zooms into.
 */
export function LightboxImage({ item, className, ...props }: LightboxImageProps): ReactNode {
  return (
    <img
      draggable={false}
      {...props}
      src={item.src}
      alt={item.alt ?? ''}
      className={clsx(styles.Image, LIGHTBOX_MEDIA_CLASS, className)}
    />
  )
}
