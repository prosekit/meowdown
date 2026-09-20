import { LightboxRoot, type LightboxController } from '@meowdown/react'

import { DemoLightboxImage } from './demo-lightbox-image.tsx'
import { DemoLightboxVideo } from './demo-lightbox-video.tsx'

export function DemoLightbox({ lightbox }: { lightbox: LightboxController }) {
  const close = () => lightbox.close()

  return (
    <LightboxRoot lightbox={lightbox}>
      {(item) => { return item.type === 'image' ? (
          <DemoLightboxImage item={item} onClose={close} />
        ) : (
          <DemoLightboxVideo item={item} onClose={close} />
        ) }
      }
    </LightboxRoot>
  )
}
