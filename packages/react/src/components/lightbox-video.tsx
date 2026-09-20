import { clsx } from 'clsx/lite'
import type { ComponentProps, ReactNode } from 'react'

import { LIGHTBOX_TRANSITION_NAME, type LightboxVideoItem } from '../hooks/use-lightbox.ts'

import styles from './lightbox.module.css'

/**
 * Props for {@link LightboxVideo}. Other props land on the `<video>`.
 */
export interface LightboxVideoProps extends Omit<
  ComponentProps<'video'>,
  'src' | 'poster' | 'children'
> {
  readonly item: LightboxVideoItem
}

/**
 * The video of a lightbox. It starts playing as soon as it opens: the click
 * that opened the lightbox is the user gesture that allows sound.
 */
export function LightboxVideo({ item, className, style, ...props }: LightboxVideoProps): ReactNode {
  const gif = item.gif === true
  return (
    <video
      controls={!gif}
      loop={gif}
      muted={gif}
      autoPlay
      playsInline
      aria-label={item.alt}
      {...props}
      poster={item.poster}
      width={item.width}
      height={item.height}
      className={clsx(styles.Video, className)}
      style={{ ...style, viewTransitionName: LIGHTBOX_TRANSITION_NAME }}
    >
      {item.sources.map((source) => (
        <source key={source.src} src={source.src} type={source.type} />
      ))}
    </video>
  )
}
