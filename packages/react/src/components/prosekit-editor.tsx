import {
  defineEditorExtension,
  docToMarkdown,
  getSelectedText,
  getTextblockDisplayText,
  isNodeOfType,
  markdownToDoc,
  type AcceptPendingReplacementOptions,
  type EditorExtension,
  type ExitBoundaryHandler,
  type FileClickHandler,
  type FileLinkResolver,
  type FilePasteOptions,
  type FileViewOptions,
  type ImageClickHandler,
  type ImageOptions,
  type LinkClickHandler,
  type LinkCopyHandler,
  type MarkMode,
  type PlaceholderOptions,
  type StartPendingReplacementOptions,
  type TagClickHandler,
  type TypedEditor,
  type WikiEmbedResolver,
  type WikilinkClickHandler,
} from '@meowdown/core'
import { clamp } from '@ocavue/utils'
import { createEditor, union, type SelectionJSON } from '@prosekit/core'
import type { EditorNode } from '@prosekit/pm/model'
import { Selection, TextSelection } from '@prosekit/pm/state'
import { ProseKit } from '@prosekit/react'
import { clsx } from 'clsx/lite'
import GithubSlugger from 'github-slugger'
import {
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'

import { defineCodeBlockView } from '../extensions/code-block-view.ts'
import type { TimeFormat } from '../utils/date-format.ts'

import { BlockHandle } from './block-handle.tsx'
import { DropIndicator } from './drop-indicator.tsx'
import { EditorExtensions } from './editor-extensions.tsx'
import { LinkMenu } from './link-menu.tsx'
import { PendingReplacementPreview } from './pending-replacement-preview.tsx'
import { SelectionMenu } from './selection-menu.tsx'
import { SlashMenu } from './slash-menu.tsx'
import { TableHandle } from './table-handle.tsx'
import { TagMenu } from './tag-menu.tsx'
import type {
  EditorHandle,
  EditorStateSnapshot,
  PendingReplacementResolveHandler,
  SelectionHint,
  SelectionMenuContext,
  SelectionMenuSearchHandler,
  SlashMenuSearchHandler,
  TagSearchHandler,
  WikilinkSearchHandler,
} from './types.ts'
import { WikilinkMenu } from './wikilink-menu.tsx'

interface FlushableDOMObserver {
  forceFlush?(): void
  flush(): void
}

function isFlushableDOMObserver(value: unknown): value is FlushableDOMObserver {
  if (typeof value !== 'object' || value === null) return false
  const forceFlush: unknown = Reflect.get(value, 'forceFlush')
  return (
    typeof Reflect.get(value, 'flush') === 'function' &&
    (forceFlush === undefined || typeof forceFlush === 'function')
  )
}

// ProseMirror can leave native contenteditable mutations queued for a timer
// turn after blur. Its observer is intentionally not part of EditorView's
// public type, so keep this guarded compatibility boundary inside Meowdown.
function flushPendingDOMChanges(editor: TypedEditor): void {
  // `editor.view` throws while unmounted, and `editor.state` deliberately
  // survives unmount — keep serialization working there.
  if (!editor.mounted) return
  const observer: unknown = Reflect.get(editor.view, 'domObserver')
  if (!isFlushableDOMObserver(observer)) return

  // `flushSoon()` blocks a plain `flush()` until its timer fires, whereas
  // `stop()` queues blur records behind a separate timer. Both calls are
  // needed to synchronously drain either path.
  observer.forceFlush?.()
  observer.flush()
}

// Selections coming through `setState` are hints: restore them exactly when
// possible, otherwise clamp to the nearest valid text selection.
function resolveSelection(doc: EditorNode, selection: SelectionHint): Selection {
  if (selection === 'start') return Selection.atStart(doc)
  if (selection === 'end') return Selection.atEnd(doc)
  try {
    return Selection.fromJSON(doc, selection)
  } catch {
    const size = doc.content.size
    // Node and all selections serialize without a head.
    const anchor = clamp(selection.anchor ?? 0, 0, size)
    const head = clamp(selection.head ?? anchor, 0, size)
    return TextSelection.between(doc.resolve(anchor), doc.resolve(head))
  }
}

function decodeHeadingFragment(fragment: string): string {
  const source = fragment.startsWith('#') ? fragment.slice(1) : fragment
  try {
    return decodeURIComponent(source)
  } catch {
    return source
  }
}

function headingLookupKey(value: string): string {
  return value.normalize('NFKC').trim().replaceAll(/\s+/g, ' ').toLowerCase()
}

function findHeadingPosition(doc: EditorNode, fragment: string): number | undefined {
  const decodedTarget = decodeHeadingFragment(fragment)
  const target = headingLookupKey(decodedTarget)
  if (!target) return
  const slugTarget = decodedTarget.normalize('NFKC').toLowerCase()
  const slugger = new GithubSlugger()
  let match: number | undefined
  doc.descendants((node, pos) => {
    if (match != null) return false
    if (!isNodeOfType(node, 'heading')) return true
    const displayText = getTextblockDisplayText(node)
    const slug = slugger.slug(displayText)
    if (
      headingLookupKey(node.textContent) === target ||
      headingLookupKey(displayText) === target ||
      slug === slugTarget
    ) {
      match = pos + 1
      return false
    }
    return true
  })
  return match
}

export interface ProseKitEditorProps {
  markMode?: MarkMode

  /**
   * The initial Markdown text of the editor. Only the value provided on the
   * first render is used; later changes are ignored.
   */
  initialMarkdown?: string

  /** Called on every user-driven document change, not on programmatic setState. */
  onDocChange?: VoidFunction

  /** Adds host items to the slash menu. See `EditorProps.onSlashMenuSearch`. */
  onSlashMenuSearch?: SlashMenuSearchHandler

  /** Enables the tag menu. See `EditorProps.onTagSearch`. */
  onTagSearch?: TagSearchHandler

  /** Enables the wikilink menu. See `EditorProps.onWikilinkSearch`. */
  onWikilinkSearch?: WikilinkSearchHandler

  /** Enables the selection menu. See `EditorProps.onSelectionMenuSearch`. */
  onSelectionMenuSearch?: SelectionMenuSearchHandler

  /** Shows the selection affordance. See `EditorProps.selectionMenuAffordance`. */
  selectionMenuAffordance?: boolean

  /** Extra pending-replacement controls. See `EditorProps.pendingReplacementActions`. */
  pendingReplacementActions?: ReactNode

  /** Called when a pending replacement ends. See `EditorProps.onPendingReplacementResolve`. */
  onPendingReplacementResolve?: PendingReplacementResolveHandler

  /** Called on click or Mod-Enter of a rendered wiki link. See `EditorProps.onWikilinkClick`. */
  onWikilinkClick?: WikilinkClickHandler

  /** Called on click or Mod-Enter of a rendered Markdown link. See `EditorProps.onLinkClick`. */
  onLinkClick?: LinkClickHandler

  /** Called after a link is copied from the link menu. See `EditorProps.onLinkCopy`. */
  onLinkCopy?: LinkCopyHandler

  /** Called on click or Mod-Enter of a rendered tag. See `EditorProps.onTagClick`. */
  onTagClick?: TagClickHandler

  /** Called when an arrow press leaves the document boundary. See `EditorProps.onExitBoundary`. */
  onExitBoundary?: ExitBoundaryHandler

  /** Resolves an image `src` to a URL. See `EditorProps.resolveImageUrl`. */
  resolveImageUrl?: ImageOptions['resolveImageUrl']

  /** Claims links as file pills. Read once on mount; see `EditorProps.resolveFileLink`. */
  resolveFileLink?: FileLinkResolver

  /** Classifies wiki embeds. Read once on mount; see `EditorProps.resolveWikiEmbed`. */
  resolveWikiEmbed?: WikiEmbedResolver

  /** Resolves the size shown on a file pill. See `EditorProps.resolveFileInfo`. */
  resolveFileInfo?: FileViewOptions['resolveFileInfo']

  /** Called on click or Mod-Enter of a rendered file pill. See `EditorProps.onFileClick`. */
  onFileClick?: FileClickHandler

  /** Persists a pasted/dropped file. See `EditorProps.onFilePaste`. */
  onFilePaste?: FilePasteOptions['onFilePaste']

  /** Called when a pasted/dropped file fails to persist. See `EditorProps.onFileSaveError`. */
  onFileSaveError?: FilePasteOptions['onFileSaveError']

  /** Called on click of a rendered image. See `EditorProps.onImageClick`. */
  onImageClick?: ImageClickHandler

  /** Auto-embeds a pasted tweet/YouTube link. See `EditorProps.embedPaste`. */
  embedPaste?: boolean

  /** Wraps the selection as a link on URL paste. See `EditorProps.linkPaste`. */
  linkPaste?: boolean

  /** Starts a bullet on Enter after a heading. See `EditorProps.bulletAfterHeading`. */
  bulletAfterHeading?: boolean

  /** Replaces typed sequences like `->` with `→`. See `EditorProps.substitution`. */
  substitution?: boolean

  /** Handles a leading YAML frontmatter block. See `EditorProps.frontmatter`. */
  frontmatter?: boolean

  /** Shows the per-block gutter handle. See `EditorProps.blockHandle`. */
  blockHandle?: boolean

  /** Placeholder text for empty blocks. See `EditorProps.placeholder`. */
  placeholder?: PlaceholderOptions['placeholder']

  /** Makes the editor read-only. See `EditorProps.readOnly`. */
  readOnly?: boolean

  /** Enables or disables spell checking in the editor. */
  spellCheck?: boolean

  /** Clock format the `/now` slash command inserts. See `EditorProps.timeFormat`. */
  timeFormat?: TimeFormat

  /** Class on the editable root. See `EditorProps.editorClassName`. */
  editorClassName?: string

  /** Imperative handle for the editor. */
  ref?: Ref<EditorHandle>

  /** Nodes rendered inside the ProseKit context. See `EditorProps.children`. */
  children?: ReactNode
}

export function ProseKitEditor({
  markMode = 'focus',
  initialMarkdown,
  onDocChange,
  onSlashMenuSearch,
  onTagSearch,
  onWikilinkSearch,
  onSelectionMenuSearch,
  selectionMenuAffordance = true,
  pendingReplacementActions,
  onPendingReplacementResolve,
  onWikilinkClick,
  onLinkClick,
  onLinkCopy,
  onTagClick,
  onExitBoundary,
  resolveImageUrl,
  resolveFileLink,
  resolveWikiEmbed,
  resolveFileInfo,
  onFileClick,
  onFilePaste,
  onFileSaveError,
  onImageClick,
  embedPaste,
  linkPaste,
  bulletAfterHeading,
  substitution = true,
  frontmatter = false,
  blockHandle = true,
  placeholder,
  readOnly,
  spellCheck,
  timeFormat,
  editorClassName,
  ref,
  children,
}: ProseKitEditorProps) {
  const [editor] = useState((): TypedEditor => {
    const baseExtension: EditorExtension = defineEditorExtension({
      resolveFileLink,
      resolveWikiEmbed,
      markMode,
    })
    const extension = union(baseExtension, defineCodeBlockView())
    const editor: TypedEditor = createEditor({ extension })
    if (initialMarkdown) {
      editor.setContent(markdownToDoc(initialMarkdown, { nodes: editor.nodes, frontmatter }))
    }
    return editor
  })

  // Set while a programmatic setState/setMarkdown dispatch runs, so the
  // doc-change handler can ignore it: a host replacing content already knows.
  const suppressDocChangeRef = useRef(false)

  // The selection the menu is open over, captured at open time so it survives
  // focus moving into the menu's filter input. Undefined while closed.
  const [selectionMenuContext, setSelectionMenuContext] = useState<SelectionMenuContext>()
  const hasSelectionMenu = !!onSelectionMenuSearch

  const openSelectionMenu = useCallback(() => {
    const { state } = editor
    const { from, to, empty } = state.selection
    if (empty) return
    setSelectionMenuContext({ selectedText: getSelectedText(state), from, to })
  }, [editor])

  const closeSelectionMenu = useCallback(() => {
    setSelectionMenuContext(undefined)
  }, [])

  useImperativeHandle(ref, () => {
    function getMarkdown(): string {
      flushPendingDOMChanges(editor)
      return docToMarkdown(editor.state.doc, { frontmatter })
    }
    function getSelection(): SelectionJSON {
      return editor.state.selection.toJSON() as SelectionJSON
    }
    function getState(): EditorStateSnapshot {
      return [getMarkdown(), getSelection()]
    }
    function replaceState(markdown?: string, selection?: SelectionHint, addToHistory = true): void {
      if (markdown == null && !selection) return
      const transaction = editor.state.tr
      if (markdown != null) {
        const doc = markdownToDoc(markdown, { nodes: editor.nodes, frontmatter })
        transaction.replaceWith(0, transaction.doc.content.size, doc.content)
      }
      if (selection) {
        transaction.setSelection(resolveSelection(transaction.doc, selection)).scrollIntoView()
      }
      if (!addToHistory) {
        transaction.setMeta('addToHistory', false)
      }
      suppressDocChangeRef.current = true
      try {
        editor.view.dispatch(transaction)
      } finally {
        suppressDocChangeRef.current = false
      }
    }
    function setState(markdown?: string, selection?: SelectionHint): void {
      replaceState(markdown, selection)
    }
    function setMarkdown(markdown: string): void {
      setState(markdown)
    }
    function refreshMarkdownRendering(): void {
      const [markdown, selection] = getState()
      replaceState(markdown, selection, false)
    }
    function insertMarkdown(markdown: string): void {
      editor.commands.insertMarkdown(markdown)
    }
    function setSelection(selection: SelectionHint): void {
      setState(undefined, selection)
    }
    function focus(): void {
      editor.focus()
    }
    function scrollIntoView(): void {
      editor.commands.scrollIntoView()
    }
    function revealHeading(fragment: string): boolean {
      const position = findHeadingPosition(editor.state.doc, fragment)
      if (position == null) return false
      const selection = TextSelection.near(editor.state.doc.resolve(position))
      editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView())
      return true
    }
    function getSelectedTextFromState(): string {
      return getSelectedText(editor.state)
    }
    function openSelectionMenuFromHandle(): void {
      if (!hasSelectionMenu) return
      openSelectionMenu()
    }
    function startPendingReplacement(options: StartPendingReplacementOptions): boolean {
      return editor.commands.startPendingReplacement(options)
    }
    function appendPendingReplacementText(text: string): void {
      editor.commands.appendPendingReplacementText(text)
    }
    function acceptPendingReplacement(options?: AcceptPendingReplacementOptions): void {
      editor.commands.acceptPendingReplacement(options ?? {})
    }
    function discardPendingReplacement(): void {
      editor.commands.discardPendingReplacement()
    }
    return {
      getMarkdown,
      setMarkdown,
      insertMarkdown,
      getState,
      setState,
      refreshMarkdownRendering,
      getSelection,
      setSelection,
      focus,
      scrollIntoView,
      revealHeading,
      getSelectedText: getSelectedTextFromState,
      openSelectionMenu: openSelectionMenuFromHandle,
      startPendingReplacement,
      appendPendingReplacementText,
      acceptPendingReplacement,
      discardPendingReplacement,
      editor,
    }
  }, [editor, frontmatter, hasSelectionMenu, openSelectionMenu])

  // Guard the host callback so programmatic setState/setMarkdown stays silent.
  // Stable per `onDocChange` identity, so the extension is not rebuilt every render.
  const handleDocChange = useMemo(() => {
    if (!onDocChange) return
    return () => {
      if (suppressDocChangeRef.current) return
      onDocChange()
    }
  }, [onDocChange])

  return (
    <ProseKit editor={editor}>
      <div ref={editor.mount} className={clsx('meowdown-content', editorClassName)}></div>
      <EditorExtensions
        markMode={markMode}
        onDocChange={handleDocChange}
        onWikilinkClick={onWikilinkClick}
        onLinkClick={onLinkClick}
        onTagClick={onTagClick}
        onExitBoundary={onExitBoundary}
        resolveImageUrl={resolveImageUrl}
        resolveFileInfo={resolveFileInfo}
        onFileClick={onFileClick}
        onFilePaste={onFilePaste}
        onFileSaveError={onFileSaveError}
        onImageClick={onImageClick}
        embedPaste={embedPaste}
        linkPaste={linkPaste}
        bulletAfterHeading={bulletAfterHeading}
        substitution={substitution}
        placeholder={placeholder}
        readOnly={readOnly}
        wikilinkEnabled={!!onWikilinkSearch}
        spellCheck={spellCheck}
      />
      {blockHandle && !readOnly && <BlockHandle />}
      {!readOnly && <TableHandle />}
      {blockHandle && !readOnly && <DropIndicator />}
      <SlashMenu
        timeFormat={timeFormat}
        onSlashMenuSearch={onSlashMenuSearch}
        onFilePaste={onFilePaste}
        onFileSaveError={onFileSaveError}
      />
      {!readOnly && <LinkMenu onLinkClick={onLinkClick} onLinkCopy={onLinkCopy} />}
      {onTagSearch && <TagMenu onTagSearch={onTagSearch} />}
      {onWikilinkSearch && <WikilinkMenu onWikilinkSearch={onWikilinkSearch} />}
      {onSelectionMenuSearch && !readOnly && (
        <SelectionMenu
          onSelectionMenuSearch={onSelectionMenuSearch}
          context={selectionMenuContext}
          onOpen={openSelectionMenu}
          onClose={closeSelectionMenu}
          affordance={selectionMenuAffordance}
        />
      )}
      {!readOnly && (
        <PendingReplacementPreview
          actions={pendingReplacementActions}
          onResolve={onPendingReplacementResolve}
        />
      )}
      {children}
    </ProseKit>
  )
}
