import {
  defineBulletAfterHeading,
  defineEmbedPaste,
  defineExitBoundaryHandler,
  defineFileClickHandler,
  defineFilePaste,
  defineFileView,
  defineHTMLPaste,
  defineImage,
  defineImageClickHandler,
  defineLinkClickHandler,
  defineMarkdownCopy,
  defineMarkMode,
  definePlaceholder,
  defineReadonly,
  defineSpellCheckPlugin,
  defineTagClickHandler,
  defineWikilinkClickHandler,
  defineWikilinkTrigger,
  type ExitBoundaryHandler,
  type FileClickHandler,
  type FilePasteOptions,
  type FileViewOptions,
  type ImageClickHandler,
  type ImageOptions,
  type LinkClickHandler,
  type MarkMode,
  type PlaceholderOptions,
  type TagClickHandler,
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
  onTagClick?: TagClickHandler
  onExitBoundary?: ExitBoundaryHandler
  resolveImageUrl?: ImageOptions['resolveImageUrl']
  resolveFileInfo?: FileViewOptions['resolveFileInfo']
  onFileClick?: FileClickHandler
  onFilePaste?: FilePasteOptions['onFilePaste']
  onFileSaveError?: FilePasteOptions['onFileSaveError']
  onImageClick?: ImageClickHandler
  embedPaste?: boolean
  bulletAfterHeading?: boolean
  placeholder?: PlaceholderOptions['placeholder']
  readOnly?: boolean
  wikilinkEnabled?: boolean
  spellCheck?: boolean
}

// A leaf that renders nothing and holds every reactive `useExtension` call (each
// runs effect hooks), so the parent editor re-renders less. `useExtension` reads
// the editor from context.
export function EditorExtensions({
  markMode,
  onDocChange,
  onWikilinkClick,
  onLinkClick,
  onTagClick,
  onExitBoundary,
  resolveImageUrl,
  resolveFileInfo,
  onFileClick,
  onFilePaste,
  onFileSaveError,
  onImageClick,
  embedPaste,
  bulletAfterHeading,
  placeholder,
  readOnly,
  wikilinkEnabled,
  spellCheck,
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
      return onTagClick ? defineTagClickHandler(onTagClick) : null
    }, [onTagClick]),
  )

  useExtension(
    useMemo(() => {
      return onExitBoundary ? defineExitBoundaryHandler(onExitBoundary) : null
    }, [onExitBoundary]),
  )

  useExtension(
    useMemo(() => {
      return defineImage({ resolveImageUrl })
    }, [resolveImageUrl]),
  )

  useExtension(
    useMemo(() => {
      return defineFileView({ resolveFileInfo })
    }, [resolveFileInfo]),
  )

  useExtension(
    useMemo(() => {
      return onFileClick ? defineFileClickHandler(onFileClick) : null
    }, [onFileClick]),
  )

  useExtension(
    useMemo(() => {
      return onFilePaste ? defineFilePaste({ onFilePaste, onFileSaveError }) : null
    }, [onFilePaste, onFileSaveError]),
  )

  useExtension(
    useMemo(() => {
      return onImageClick ? defineImageClickHandler(onImageClick) : null
    }, [onImageClick]),
  )

  useExtension(
    useMemo(() => {
      return embedPaste ? defineEmbedPaste() : null
    }, [embedPaste]),
  )

  useExtension(
    useMemo(() => {
      return defineHTMLPaste()
    }, []),
  )

  useExtension(
    useMemo(() => {
      return defineMarkdownCopy()
    }, []),
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

  useExtension(
    useMemo(() => {
      return wikilinkEnabled ? defineWikilinkTrigger() : null
    }, [wikilinkEnabled]),
  )

  useExtension(
    useMemo(() => {
      return spellCheck == null ? null : defineSpellCheckPlugin(spellCheck)
    }, [spellCheck]),
  )

  return null
}
