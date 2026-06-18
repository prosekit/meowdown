import {
  defineBulletAfterHeading,
  defineEmbedPaste,
  defineImage,
  defineLinkClickHandler,
  defineMarkMode,
  definePlaceholder,
  defineReadonly,
  defineWikilinkClickHandler,
  type ImageOptions,
  type LinkClickHandler,
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
  onLinkClick?: LinkClickHandler
  resolveImageUrl?: ImageOptions['resolveImageUrl']
  onImagePaste?: ImageOptions['onImagePaste']
  onImageSaveError?: ImageOptions['onImageSaveError']
  embedPaste?: boolean
  bulletAfterHeading?: boolean
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
  onLinkClick,
  resolveImageUrl,
  onImagePaste,
  onImageSaveError,
  embedPaste,
  bulletAfterHeading,
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
      return onLinkClick ? defineLinkClickHandler(onLinkClick) : null
    }, [onLinkClick]),
  )

  useExtension(
    useMemo(() => {
      return defineImage({ resolveImageUrl, onImagePaste, onImageSaveError })
    }, [resolveImageUrl, onImagePaste, onImageSaveError]),
  )

  useExtension(
    useMemo(() => {
      return embedPaste ? defineEmbedPaste() : null
    }, [embedPaste]),
  )

  useExtension(
    useMemo(() => {
      return bulletAfterHeading ? defineBulletAfterHeading() : null
    }, [bulletAfterHeading]),
  )

  useExtension(
    useMemo(() => {
      // 'doc' so the placeholder shows only when the whole document is empty,
      // not in every empty block the caret enters.
      return placeholder ? definePlaceholder({ placeholder, strategy: 'doc' }) : null
    }, [placeholder]),
  )

  return null
}
