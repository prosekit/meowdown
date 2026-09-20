import { LightboxImage, type LightboxImageItem } from '@meowdown/react'

export function DemoLightboxImage({
  item,
  onClose,
}: {
  item: LightboxImageItem
  onClose: () => void
}) {
  return (
    <button
      type="button"
      aria-label="Close image preview"
      className="absolute inset-0 flex cursor-zoom-out items-center justify-center border-0 bg-transparent p-[inherit]"
      onClick={onClose}
    >
      <LightboxImage item={item} />
    </button>
  )
}
