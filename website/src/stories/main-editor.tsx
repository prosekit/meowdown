import './stories.css'

import { Transaction } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { MeowdownEditor, type EditorHandle } from '@meowdown/react'
import { throttle } from '@ocavue/utils'
import { useQueryStates } from 'nuqs'
import { NuqsAdapter } from 'nuqs/adapters/react'
import { useEffect, useRef, useState } from 'react'

import { WikilinkPreviewCard } from '../components/wikilink-preview-card.tsx'
import {
  handleImageClick,
  handleLinkClick,
  handleTagClick,
  handleWikilinkClick,
  searchNotes,
  searchTags,
} from '../lib/demo-data.ts'
import { computeTextPatch } from '../lib/text-patch.ts'
import { useMounted } from '../lib/use-mounted.ts'
import { getPresetContent } from '../presets/presets.ts'

import { CodeMirrorPane } from './codemirror-pane.tsx'
import { MODES, PLAYGROUND_PARAMS, PRESET_IDS, SPELLCHECKS } from './playground-params.ts'
import { SyncStatusPill, type SyncStatus } from './sync-status.tsx'

const fieldClass =
  'flex cursor-pointer items-center gap-1.5 text-sm text-stone-600 dark:text-stone-300'

// Both directions settle on the same delay: one `getMarkdown()` or one parse a
// second keeps large documents cheap either way.
const SYNC_THROTTLE_MS = 1000

// The "Saved" pill is a confirmation, not a status line; it clears itself.
const SAVED_LINGER_MS = 2000

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className={fieldClass}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  )
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
}) {
  return (
    <label className={fieldClass}>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="cursor-pointer rounded-lg border border-solid border-black/12 bg-white px-2 py-1 [font:inherit] text-inherit dark:border-white/16 dark:bg-stone-900"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function MainEditorDemo() {
  const [params, setParams] = useQueryStates(PLAYGROUND_PARAMS)
  const { mode, doc, spellcheck, readOnly, blockHandle, caretGlide, source: showSource } = params

  const editorRef = useRef<EditorHandle>(null)
  const sourceViewRef = useRef<EditorView>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>()
  // The document both panes are created with: the shared content when the link
  // carries one, otherwise the selected preset.
  const [initialMarkdown] = useState(() => params.content ?? getPresetContent(params.doc))
  // The seed of the source pane, refreshed whenever the pane is toggled on.
  const [sourceSeed, setSourceSeed] = useState(initialMarkdown)

  // Both sync directions are created once; they close over the two stable
  // refs, so they never need to be re-created.
  const [{ handleRichChange, handleSourceChange, flushToSource }] = useState(() => {
    // nuqs' setter is referentially stable for a module-level key map, so
    // capturing it once here is safe. Only the two throttled ticks call this,
    // and both run after a user edit; a preset switch clears `content` instead.
    const shareMarkdown = (markdown: string) => {
      setSyncStatus('saved')
      void setParams({ content: markdown })
    }

    // ProseMirror -> CodeMirror, as the smallest patch that gets there, so the
    // source caret and scroll position survive. The `remote` annotation is what
    // stops the write from coming straight back as a user edit.
    const writeSourceText = () => {
      const view = sourceViewRef.current
      const markdown = editorRef.current?.getMarkdown()
      if (!view || markdown == null) return
      const patch = computeTextPatch(view.state.doc.toString(), markdown)
      if (!patch) return
      view.dispatch({ changes: patch, annotations: Transaction.remote.of(true) })
    }

    // CodeMirror -> ProseMirror. setMarkdown no-ops on equivalent markdown and
    // stays silent to onDocChange, so neither direction echoes.
    const writeRichText = (markdown: string) => {
      shareMarkdown(markdown)
      editorRef.current?.setMarkdown(markdown)
    }

    const pushToSource = throttle(() => {
      shareMarkdown(editorRef.current?.getMarkdown() ?? '')
      // A stale trailing tick must never overwrite source text being typed now.
      if (sourceViewRef.current?.hasFocus) return
      writeSourceText()
    }, SYNC_THROTTLE_MS)

    const pullFromSource = throttle(writeRichText, SYNC_THROTTLE_MS)

    return {
      handleRichChange: () => {
        setSyncStatus('editing')
        pushToSource()
      },
      handleSourceChange: (markdown: string) => {
        setSyncStatus('editing')
        pullFromSource(markdown)
      },
      // Focus is about to land in the source pane, or a preset was picked: make
      // the source text current before anything is typed into stale text.
      flushToSource: writeSourceText,
    }
  })

  useEffect(() => {
    if (syncStatus !== 'saved') return
    const timer = setTimeout(() => setSyncStatus(undefined), SAVED_LINGER_MS)
    return () => clearTimeout(timer)
  }, [syncStatus])

  const selectPreset = (id: string) => {
    void setParams({ doc: id, content: null })
    editorRef.current?.setMarkdown(getPresetContent(id))
    flushToSource()
  }

  const toggleSource = (show: boolean) => {
    if (show) {
      setSourceSeed(editorRef.current?.getMarkdown() ?? '')
    }
    void setParams({ source: show })
  }

  return (
    <div className="box-border flex h-full flex-col gap-3 p-4">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 relative">
        <SelectField
          label="Mode"
          value={mode}
          options={MODES}
          onChange={(value) => void setParams({ mode: value })}
        />
        <SelectField label="Document" value={doc} options={PRESET_IDS} onChange={selectPreset} />
        <SelectField
          label="Spellcheck"
          value={spellcheck}
          options={SPELLCHECKS}
          onChange={(value) => void setParams({ spellcheck: value })}
        />
        <ToggleField
          label="Readonly"
          checked={readOnly}
          onChange={(checked) => void setParams({ readOnly: checked })}
        />
        <ToggleField
          label="Block handle"
          checked={blockHandle}
          onChange={(checked) => void setParams({ blockHandle: checked })}
        />
        <ToggleField
          label="Caret glide"
          checked={caretGlide}
          onChange={(checked) => void setParams({ caretGlide: checked })}
        />
        <ToggleField label="Source" checked={showSource} onChange={toggleSource} />
        {syncStatus && <SyncStatusPill status={syncStatus} />}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto rounded-xl border border-solid border-black/8 bg-white dark:border-white/12 dark:bg-stone-900">
          <MeowdownEditor
            mode={mode}
            spellCheck={spellcheck === 'default' ? undefined : spellcheck === 'on'}
            readOnly={readOnly}
            blockHandle={blockHandle}
            caretGlide={caretGlide}
            initialMarkdown={initialMarkdown}
            handleRef={editorRef}
            onDocChange={handleRichChange}
            onTagSearch={searchTags}
            onWikilinkSearch={searchNotes}
            onImageClick={handleImageClick}
            onLinkClick={handleLinkClick}
            onTagClick={handleTagClick}
            onWikilinkClick={handleWikilinkClick}
          >
            <WikilinkPreviewCard />
          </MeowdownEditor>
        </div>

        {showSource && (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto rounded-xl border border-solid border-black/8 bg-white dark:border-white/12 dark:bg-stone-900">
            <CodeMirrorPane
              initialDoc={sourceSeed}
              readOnly={readOnly}
              viewRef={sourceViewRef}
              onChange={handleSourceChange}
              onFocus={flushToSource}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function MainEditor() {
  const mounted = useMounted()
  if (!mounted) return null
  // Inside the mount gate: nuqs reads an empty search string on the server, so
  // rendering its hooks during SSR would mismatch a populated URL on the client.
  return (
    <NuqsAdapter>
      <MainEditorDemo />
    </NuqsAdapter>
  )
}
