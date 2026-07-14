import {
  defineBulletAfterHeading,
  defineEmbedPaste,
  defineExitBoundaryHandler,
  defineFileClickHandler,
  defineFilePaste,
  defineFileView,
  defineFollowLinkHandler,
  defineImage,
  defineImageClickHandler,
  defineLinkClickHandler,
  defineLinkPaste,
  definePlaceholder,
  defineReadonly,
  defineSpellCheckPlugin,
  defineSubstitution,
  defineTagClickHandler,
  defineWikilinkClickHandler,
  defineWikilinkTrigger,
  type EditorExtension,
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
import { useEditor, useExtension } from '@prosekit/react'
import { useEffect, useMemo } from 'react'

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
  linkPaste?: boolean
  bulletAfterHeading?: boolean
  substitution?: boolean
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
  linkPaste,
  bulletAfterHeading,
  substitution,
  placeholder,
  readOnly,
  wikilinkEnabled,
  spellCheck,
}: EditorExtensionsProps): null {
  // The mark-mode plugin ships in the creation extension so the first paint
  // already hides the syntax; here only later `markMode` changes are applied.
  // The command no-ops when the state already has that mode.
  const editor = useEditor<EditorExtension>()
  useEffect(() => {
    editor.commands.setMarkMode(markMode)
  }, [editor, markMode])

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
      // Mod-Enter follows the link under the caret through the same handlers
      // a click uses.
      return onWikilinkClick || onTagClick || onFileClick || onLinkClick
        ? defineFollowLinkHandler({ onWikilinkClick, onTagClick, onFileClick, onLinkClick })
        : null
    }, [onWikilinkClick, onTagClick, onFileClick, onLinkClick]),
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
      return linkPaste ? defineLinkPaste() : null
    }, [linkPaste]),
  )

  useExtension(
    useMemo(() => {
      return bulletAfterHeading ? defineBulletAfterHeading() : null
    }, [bulletAfterHeading]),
  )

  useExtension(
    useMemo(() => {
      return substitution ? defineSubstitution() : null
    }, [substitution]),
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
