import './stories.css'

import { Transaction } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { MeowdownEditor, type EditorHandle, type EditorMode } from '@meowdown/react'
import { throttle } from '@ocavue/utils'
import { useRef, useState } from 'react'

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
import { getPresetContent, PRESETS } from '../presets/presets.ts'

import { CodeMirrorPane } from './codemirror-pane.tsx'

const MODES: readonly EditorMode[] = ['focus', 'show', 'hide']
const SPELLCHECKS = ['default', 'on', 'off'] as const
type Spellcheck = (typeof SPELLCHECKS)[number]

const PRESET_IDS = PRESETS.map((preset) => preset.id)

const fieldClass =
  'flex cursor-pointer items-center gap-1.5 text-sm text-stone-600 dark:text-stone-300'
const INITIAL_PRESET = PRESETS[0]

// Both directions settle on the same delay: one `getMarkdown()` or one parse a
// second keeps large documents cheap either way.
const SYNC_THROTTLE_MS = 1000

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
  const [mode, setMode] = useState<EditorMode>('focus')
  const [spellcheck, setSpellcheck] = useState<Spellcheck>('default')
  const [readOnly, setReadOnly] = useState(false)
  const [blockHandle, setBlockHandle] = useState(true)
  const [caretGlide, setCaretGlide] = useState(true)
  const [showSource, setShowSource] = useState(true)
  const [preset, setPreset] = useState(INITIAL_PRESET.id)

  const editorRef = useRef<EditorHandle>(null)
  const sourceViewRef = useRef<EditorView>(null)
  // The seed of the source pane, refreshed whenever the pane is toggled on.
  const [sourceSeed, setSourceSeed] = useState(INITIAL_PRESET.content)

  // Both sync directions are created once; they close over the two stable
  // refs, so they never need to be re-created.
  const [{ handleRichChange, handleSourceChange, flushToSource }] = useState(() => {
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
      editorRef.current?.setMarkdown(markdown)
    }

    const pushToSource = throttle(() => {
      // A stale trailing tick must never overwrite source text being typed now.
      if (sourceViewRef.current?.hasFocus) return
      writeSourceText()
    }, SYNC_THROTTLE_MS)

    const pullFromSource = throttle(writeRichText, SYNC_THROTTLE_MS)

    return {
      handleRichChange: pushToSource,
      handleSourceChange: pullFromSource,
      // Focus is about to land in the source pane, or a preset was picked: make
      // the source text current before anything is typed into stale text.
      flushToSource: writeSourceText,
    }
  })

  const selectPreset = (id: string) => {
    setPreset(id)
    editorRef.current?.setMarkdown(getPresetContent(id))
    flushToSource()
  }

  const toggleSource = (show: boolean) => {
    if (show) {
      setSourceSeed(editorRef.current?.getMarkdown() ?? '')
    }
    setShowSource(show)
  }

  return (
    <div className="box-border flex h-full flex-col gap-3 p-4">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        <SelectField label="Mode" value={mode} options={MODES} onChange={setMode} />
        <SelectField label="Document" value={preset} options={PRESET_IDS} onChange={selectPreset} />
        <SelectField
          label="Spellcheck"
          value={spellcheck}
          options={SPELLCHECKS}
          onChange={setSpellcheck}
        />
        <ToggleField label="Readonly" checked={readOnly} onChange={setReadOnly} />
        <ToggleField label="Block handle" checked={blockHandle} onChange={setBlockHandle} />
        <ToggleField label="Caret glide" checked={caretGlide} onChange={setCaretGlide} />
        <ToggleField label="Source" checked={showSource} onChange={toggleSource} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto rounded-xl border border-solid border-black/8 bg-white dark:border-white/12 dark:bg-stone-900">
          <MeowdownEditor
            mode={mode}
            spellCheck={spellcheck === 'default' ? undefined : spellcheck === 'on'}
            readOnly={readOnly}
            blockHandle={blockHandle}
            caretGlide={caretGlide}
            initialMarkdown={INITIAL_PRESET.content}
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
  return mounted ? <MainEditorDemo /> : null
}
