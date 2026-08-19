import type { ExitBoundaryHandler } from '@meowdown/core'
import { MarkdownView, MeowdownEditor, type EditorHandle } from '@meowdown/react'
import { getId } from '@ocavue/utils'
import { clsx } from 'clsx/lite'
import { useCallback, useEffect, useRef, useState } from 'react'

import { SegmentedControl } from '../components/segmented-control.tsx'
import { WikilinkPreviewCard } from '../components/wikilink-preview-card.tsx'
import {
  handleFileClick,
  handleImageClick,
  handleLinkClick,
  handleTagClick,
  handleWikilinkClick,
  resolveFileInfo,
  resolveFileLink,
  searchNotes,
  searchTags,
  uploadAndTrackFile,
} from '../lib/demo-data.ts'
import { useMounted } from '../lib/use-mounted.ts'
import INITIAL_CONTENT from '../presets/000-default.md?raw'

import { FindShortcut, useFindDemo } from './find-demo.tsx'
import { SelectionMenuShortcut, useSelectionDemo } from './selection-demo.tsx'
import { MODES, useEditorMode } from './use-editor-mode.ts'

export function HomeDemo() {
  // The page is server-rendered: until the island hydrates and mounts, the
  // editor slot shows a static read-only render of the same document.
  const mounted = useMounted()
  const { mode, setMode, activeMode } = useEditorMode()

  const editorRef = useRef<EditorHandle>(null)
  const selectionDemo = useSelectionDemo(editorRef)
  const findDemo = useFindDemo(editorRef)

  const [spellCheck, setSpellCheck] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const id = setTimeout(() => {
      const urlParams = new URLSearchParams(window.location.search)
      const value = urlParams.get('spellcheck') || urlParams.get('spellCheck')

      if (value === 'true') {
        setSpellCheck(true)
        console.log('[meowdown] Spellcheck enabled')
      } else if (value === 'false') {
        setSpellCheck(false)
        console.log('[meowdown] Spellcheck disabled')
      } else if (value) {
        console.warn(
          `[meowdown] Invalid spellcheck value in URL query: ${value}. Expected "true" or "false".`,
        )
      }
    }, 0)

    return () => {
      clearTimeout(id)
    }
  }, [])

  // When the caret leaves the document boundary (onExitBoundary), briefly flash
  // a top or bottom border inside the editor box. A bumped id remounts the
  // overlay so its one-shot fade restarts on every press.
  const [edgeFlash, setEdgeFlash] = useState<{ id: number; direction: 'up' | 'down' }>()
  const handleExitBoundary: ExitBoundaryHandler = useCallback(({ direction }) => {
    setEdgeFlash({ id: getId(), direction })
  }, [])

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-2xl shadow-orange-500/20 ring-1 ring-black/5 dark:border-stone-800 dark:bg-stone-900 dark:shadow-black/40 dark:ring-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 bg-stone-50/60 px-4 py-2.5 sm:px-5 dark:border-stone-800 dark:bg-stone-950/30">
        <div className="flex items-center gap-2.5 text-sm font-medium text-stone-500 dark:text-stone-400">
          <span className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400 ring-1 ring-black/10 ring-inset" />
            <span className="h-3 w-3 rounded-full bg-amber-400 ring-1 ring-black/10 ring-inset" />
            <span className="h-3 w-3 rounded-full bg-green-400 ring-1 ring-black/10 ring-inset" />
          </span>
          <span>untitled.md</span>
        </div>
        <SegmentedControl
          ariaLabel="Markdown syntax visibility"
          options={MODES}
          value={mode}
          onChange={setMode}
        />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {!mounted && (
            <div className="meowdown">
              <MarkdownView markdown={INITIAL_CONTENT} interactive={false} />
            </div>
          )}
          {mounted && (
            <MeowdownEditor
              mode={mode}
              spellCheck={spellCheck}
              searchQuery={findDemo.query}
              onSearchChange={findDemo.onSearchChange}
              initialMarkdown={INITIAL_CONTENT}
              handleRef={editorRef}
              onTagSearch={searchTags}
              onWikilinkSearch={searchNotes}
              onSelectionMenuSearch={selectionDemo.onSelectionMenuSearch}
              pendingReplacementActions={selectionDemo.pendingReplacementActions}
              onPendingReplacementResolve={selectionDemo.onPendingReplacementResolve}
              onFilePaste={uploadAndTrackFile}
              resolveFileLink={resolveFileLink}
              resolveFileInfo={resolveFileInfo}
              onFileClick={handleFileClick}
              onImageClick={handleImageClick}
              onLinkClick={handleLinkClick}
              onTagClick={handleTagClick}
              onWikilinkClick={handleWikilinkClick}
              onExitBoundary={handleExitBoundary}
            >
              <SelectionMenuShortcut onTrigger={selectionDemo.openMenu} />
              <FindShortcut onTrigger={findDemo.openBar} />
              <WikilinkPreviewCard />
            </MeowdownEditor>
          )}
        </div>

        {findDemo.bar}

        {edgeFlash && (
          <div
            key={edgeFlash.id}
            onAnimationEnd={() => setEdgeFlash(undefined)}
            aria-hidden
            className={clsx(
              'edge-border',
              'border-0 pointer-events-none absolute inset-0 z-10',
              'border-(--meowdown-accent)',
              edgeFlash.direction === 'up' ? 'border-t-2' : 'border-b-2',
            )}
          />
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-stone-200/80 bg-stone-50/60 px-4 py-3 text-sm sm:px-5 dark:border-stone-800 dark:bg-stone-950/30">
        <span key={mode} className="mode-desc flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-semibold text-stone-700 dark:text-stone-200">
            {activeMode.label}
          </span>
          <span className="text-stone-300 dark:text-stone-600">·</span>
          <span className="text-stone-500 dark:text-stone-400">{activeMode.description}</span>
        </span>
        <span className="ml-auto hidden shrink-0 text-xs text-stone-400 sm:block dark:text-stone-500">
          Press ⌘F to find in the document
        </span>
      </div>
    </section>
  )
}
