import './stories.css'

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

// The rich pane pushes to the source pane near-real-time; one `getMarkdown()`
// call at most every 1.5s keeps large documents cheap.
const PUSH_THROTTLE_MS = 1500

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
  const [{ pushToSource, pullFromSource }] = useState(() => {
    // ProseMirror -> CodeMirror. Only fires on user edits (programmatic
    // setMarkdown suppresses onDocChange) and never rewrites a focused source
    // pane.
    const pushToSource = throttle(() => {
      const markdown = editorRef.current?.getMarkdown()
      const view = sourceViewRef.current
      if (markdown == null || !view || view.hasFocus) return
      if (view.state.doc.toString() === markdown) return
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: markdown } })
    }, PUSH_THROTTLE_MS)

    // CodeMirror -> ProseMirror, on blur only. setMarkdown no-ops on
    // equivalent markdown and stays silent to onDocChange, so neither
    // direction echoes. The push flushes rich-pane edits that were held back
    // while the source pane had focus.
    const pullFromSource = (markdown: string) => {
      editorRef.current?.setMarkdown(markdown)
      pushToSource()
    }

    return { pushToSource, pullFromSource }
  })

  const selectPreset = (id: string) => {
    setPreset(id)
    editorRef.current?.setMarkdown(getPresetContent(id))
    pushToSource()
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
            onDocChange={pushToSource}
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
              onBlur={pullFromSource}
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
