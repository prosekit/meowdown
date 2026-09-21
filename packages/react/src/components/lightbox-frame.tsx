import { clsx } from 'clsx/lite'
import type { ComponentProps, CSSProperties, ReactNode } from 'react'

import { LIGHTBOX_TRANSITION_NAME, type LightboxFrameItem } from '../hooks/use-lightbox.ts'

import styles from './lightbox.module.css'

/**
 * Props for {@link LightboxFrame}. Other props land on the `<iframe>`.
 */
export interface LightboxFrameProps extends Omit<
  ComponentProps<'iframe'>,
  'src' | 'title' | 'children'
> {
  readonly item: LightboxFrameItem
}

/**
 * The embedded page of a lightbox, such as a video player: the largest box of
 * the item's aspect ratio that fits.
 */
export function LightboxFrame({ item, className, style, ...props }: LightboxFrameProps): ReactNode {
  const ratio = item.width && item.height ? item.width / item.height : 16 / 9
  const frameStyle = {
    ...style,
    '--meowdown-lightbox-frame-ratio': String(ratio),
    backgroundImage: item.poster ? `url(${JSON.stringify(item.poster)})` : undefined,
    viewTransitionName: LIGHTBOX_TRANSITION_NAME,
  } as CSSProperties
  return (
    <iframe
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      {...props}
      src={item.src}
      title={item.title}
      className={clsx(styles.Frame, className)}
      style={frameStyle}
    />
  )
}
