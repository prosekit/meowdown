import {
  defineImages,
  defineMarkMode,
  definePlaceholder,
  defineReadonly,
  defineWikilinkClickHandler,
  type ImageOptions,
  type MarkMode,
  type PlaceholderOptions,
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
  placeholder?: PlaceholderOptions['placeholder']
  readOnly?: boolean
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
  placeholder,
  readOnly,
}: EditorExtensionsProps): null {
  useExtension(
    useMemo(() => {
      return defineMarkMode(markMode)
    }, [markMode]),
  )

  useExtension(
    useMemo(() => {
      return readOnly ? defineReadonly() : null
    }, [readOnly]),
  )

  useExtension(
    useMemo(() => {
      return onDocChange ? defineDocChangeHandler(onDocChange) : null
    }, [onDocChange]),
  )

  useExtension(
    useMemo(() => {
      return onWikilinkClick ? defineWikilinkClickHandler(onWikilinkClick) : null
    }, [onWikilinkClick]),
  )

  useExtension(
    useMemo(() => {
      return resolveImageUrl
        ? defineImages({ resolveImageUrl, onImagePaste, onImageSaveError })
        : null
    }, [resolveImageUrl, onImagePaste, onImageSaveError]),
  )

  useExtension(
    useMemo(() => {
      return placeholder ? definePlaceholder({ placeholder }) : null
    }, [placeholder]),
  )

  return null
}
