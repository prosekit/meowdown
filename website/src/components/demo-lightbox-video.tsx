import { LightboxVideo, type LightboxVideoItem } from '@meowdown/react'
import type { MouseEvent } from 'react'

export function DemoLightboxVideo({
  item,
  onClose,
}: {
  item: LightboxVideoItem
  onClose: () => void
}) {
  // A click on the dimmed area around the player closes; one on the player
  // itself reaches its controls.
  const handleBackgroundClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-[inherit]"
      onClick={handleBackgroundClick}
    >
      <LightboxVideo item={item} />
      <button
        type="button"
        aria-label="Close"
        className="absolute top-4 right-4 flex size-10 cursor-pointer items-center justify-center rounded-full border-0 bg-white/15 text-white backdrop-blur-xl hover:bg-white/25"
        onClick={onClose}
      >
        <span className="i-lucide-x size-5" />
      </button>
    </div>
  )
}
