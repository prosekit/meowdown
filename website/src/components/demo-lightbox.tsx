import { LightboxImage, LightboxRoot, type LightboxController } from '@meowdown/react'

export function DemoLightbox({ lightbox }: { lightbox: LightboxController }) {
  return (
    <LightboxRoot lightbox={lightbox}>
      {(item) => (
        <button
          type="button"
          aria-label="Close image preview"
          className="absolute inset-0 flex cursor-zoom-out items-center justify-center border-0 bg-transparent p-[inherit]"
          onClick={() => lightbox.close()}
        >
          <LightboxImage item={item} />
        </button>
      )}
    </LightboxRoot>
  )
}
