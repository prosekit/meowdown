import {
  defineImages,
  defineMarkMode,
  defineWikilinkClickHandler,
  type ImageOptions,
  type MarkMode,
  type WikilinkClickHandler,
} from '@meowdown/core'
import { defineDocChangeHandler } from '@prosekit/core'
import { useExtension } from '@prosekit/react'
import { useMemo } from 'react'

export interface EditorExtensionsProps {
  markMode: MarkMode
  onDocChange?: VoidFunction
  onWikilinkClick?: WikilinkClickHandler
  resolveImageUrl?: ImageOptions['resolveImageUrl']
  onImagePaste?: ImageOptions['onImagePaste']
  onImageSaveError?: ImageOptions['onImageSaveError']
}

// A leaf that renders nothing and holds every reactive `useExtension` call (each
// runs effect hooks), so the parent editor re-renders less. `useExtension` reads
// the editor from context.
export function EditorExtensions({
  markMode,
  onDocChange,
  onWikilinkClick,
  resolveImageUrl,
  onImagePaste,
  onImageSaveError,
}: EditorExtensionsProps): null {
  useExtension(useMemo(() => defineMarkMode(markMode), [markMode]))

  useExtension(
    useMemo(() => (onDocChange ? defineDocChangeHandler(onDocChange) : null), [onDocChange]),
  )

  useExtension(
    useMemo(
      () => (onWikilinkClick ? defineWikilinkClickHandler(onWikilinkClick) : null),
      [onWikilinkClick],
    ),
  )

  useExtension(
    useMemo(
      () =>
        resolveImageUrl ? defineImages({ resolveImageUrl, onImagePaste, onImageSaveError }) : null,
      [resolveImageUrl, onImagePaste, onImageSaveError],
    ),
  )

  return null
}
