import type { EditorView } from '@codemirror/view'
import { MeowdownEditor, type EditorHandle } from '@meowdown/react'
import { throttle } from '@ocavue/utils'
import { debounce, useQueryState, useQueryStates } from 'nuqs'
import { NuqsAdapter } from 'nuqs/adapters/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { SegmentedControl } from '../components/segmented-control.tsx'
import { WikilinkPreviewCard } from '../components/wikilink-preview-card.tsx'
import { MODES } from '../home/use-editor-mode.ts'
import {
  handleImageClick,
  handleLinkClick,
  handleTagClick,
  handleWikilinkClick,
  searchNotes,
  searchTags,
} from '../lib/demo-data.ts'
import { getPresetContent, PRESETS } from '../presets/presets.ts'
import { CodeMirrorPane } from './codemirror-pane.tsx'
import {
  parseAsCompressedMarkdown,
  parseAsFlag,
  parseAsMode,
  parseAsPreset,
  parseAsSpellcheck,
  SPELLCHECK_VALUES,
} from './url-state.ts'

const playgroundParsers = {
  mode: parseAsMode,
  spellcheck: parseAsSpellcheck,
  readonly: parseAsFlag.withDefault(false),
  handle: parseAsFlag.withDefault(true),
  glide: parseAsFlag.withDefault(true),
  source: parseAsFlag.withDefault(true),
  preset: parseAsPreset,
}

// The rich pane pushes to the source pane near-real-time; one `getMarkdown()`
// call at most every 1.5s keeps large documents cheap.
const PUSH_THROTTLE_MS = 1500

const DOC_URL_DEBOUNCE_MS = 800
// lz-string halves markdown at worst; 20K raw chars keeps the URL inside a
// realistic ~8K shareable budget.
const DOC_URL_MAX_CHARS = 20_000
const DOC_TRUNCATION_NOTICE =
  '\n\n---\n\nTruncated: this shared document was cut here to fit into the URL.'

// The shared copy is cut at a line boundary with a notice appended; the live
// editor content is never truncated.
function clampDocForUrl(markdown: string): string {
  if (markdown.length <= DOC_URL_MAX_CHARS) return markdown
  const head = markdown.slice(0, DOC_URL_MAX_CHARS)
  const lastLineBreak = head.lastIndexOf('\n')
  return (lastLineBreak > 0 ? head.slice(0, lastLineBreak) : head) + DOC_TRUNCATION_NOTICE
}

const SPELLCHECK_OPTIONS = SPELLCHECK_VALUES.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}))

const PRESET_OPTIONS = PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))

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
    <label className="flex cursor-pointer items-center gap-1.5 text-sm text-stone-600 dark:text-stone-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-amber-500"
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
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-stone-600 dark:text-stone-300">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="cursor-pointer rounded-lg border border-stone-200/80 bg-white/70 px-2 py-1 text-sm text-stone-700 dark:border-stone-700/70 dark:bg-stone-900/70 dark:text-stone-200"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function PlaygroundApp() {
  const [options, setOptions] = useQueryStates(playgroundParsers)
  const [doc, setDoc] = useQueryState(
    'doc',
    parseAsCompressedMarkdown.withOptions({ limitUrlUpdates: debounce(DOC_URL_DEBOUNCE_MS) }),
  )
  const editorRef = useRef<EditorHandle>(null)
  const sourceViewRef = useRef<EditorView>(null)
  // The last markdown one pane accepted from the other. Lets the blur pull
  // tell "the user edited the source" apart from "the push wrote this text".
  const lastSyncedRef = useRef<string | undefined>(undefined)

  // The editor is uncontrolled: the initial document is resolved once, and
  // later preset switches go through the imperative handle.
  const [initialDoc] = useState(() => doc ?? getPresetContent(options.preset))
  // The seed of the source pane, refreshed whenever the pane is toggled on.
  const [sourceSeed, setSourceSeed] = useState(initialDoc)

  // Kept in sync via an effect so the stable sync callbacks below can read the
  // current preset without re-capturing it.
  const presetRef = useRef(options.preset)
  useEffect(() => {
    presetRef.current = options.preset
  }, [options.preset])

  // A document matching its preset (or over budget after clamping to the
  // preset either way) keeps the URL clean.
  const writeDocParam = useCallback(
    (markdown: string) => {
      const shared = clampDocForUrl(markdown)
      return setDoc(shared === getPresetContent(presetRef.current) ? null : shared)
    },
    [setDoc],
  )

  // ProseMirror -> CodeMirror. Only fires on user edits (programmatic
  // setMarkdown suppresses onDocChange) and never rewrites a focused source
  // pane.
  const pushToSource = useMemo(
    () =>
      throttle(() => {
        const markdown = editorRef.current?.getMarkdown()
        if (markdown == null) return
        void writeDocParam(markdown)
        const view = sourceViewRef.current
        if (!view || view.hasFocus) return
        if (view.state.doc.toString() === markdown) return
        lastSyncedRef.current = markdown
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: markdown } })
      }, PUSH_THROTTLE_MS),
    [writeDocParam],
  )

  // CodeMirror -> ProseMirror, on blur only. setMarkdown no-ops on equivalent
  // markdown and stays silent to onDocChange, so neither direction echoes.
  const pullFromSource = useCallback(
    (markdown: string) => {
      if (markdown !== lastSyncedRef.current) {
        lastSyncedRef.current = markdown
        editorRef.current?.setMarkdown(markdown)
        void writeDocParam(markdown)
      }
      // Flush rich-pane edits the push held back while the source pane had
      // focus.
      pushToSource()
    },
    [pushToSource, writeDocParam],
  )

  const selectPreset = useCallback(
    (preset: string) => {
      void setOptions({ preset })
      void setDoc(null)
      editorRef.current?.setMarkdown(getPresetContent(preset))
      pushToSource()
    },
    [setOptions, setDoc, pushToSource],
  )

  const copyShareLink = useCallback(async () => {
    const markdown = editorRef.current?.getMarkdown() ?? ''
    await writeDocParam(markdown)
    await navigator.clipboard.writeText(window.location.href)
  }, [writeDocParam])

  const toggleSource = useCallback(
    (source: boolean) => {
      if (source) {
        setSourceSeed(editorRef.current?.getMarkdown() ?? '')
      }
      void setOptions({ source })
    },
    [setOptions],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 sm:px-6 sm:pb-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-stone-200/80 bg-white/70 px-4 py-2.5 dark:border-stone-800 dark:bg-stone-900/70">
        <SegmentedControl
          ariaLabel="Markdown syntax visibility"
          name="playground-mode"
          options={MODES}
          value={options.mode}
          onChange={(mode) => void setOptions({ mode })}
        />
        <SelectField
          label="Document"
          value={options.preset}
          options={PRESET_OPTIONS}
          onChange={selectPreset}
        />
        <SelectField
          label="Spellcheck"
          value={options.spellcheck}
          options={SPELLCHECK_OPTIONS}
          onChange={(spellcheck) => void setOptions({ spellcheck })}
        />
        <ToggleField
          label="Readonly"
          checked={options.readonly}
          onChange={(readonly) => void setOptions({ readonly })}
        />
        <ToggleField
          label="Block handle"
          checked={options.handle}
          onChange={(handle) => void setOptions({ handle })}
        />
        <ToggleField
          label="Caret glide"
          checked={options.glide}
          onChange={(glide) => void setOptions({ glide })}
        />
        <ToggleField label="Source" checked={options.source} onChange={toggleSource} />
        <button
          type="button"
          onClick={() => void copyShareLink()}
          className="ml-auto cursor-pointer rounded-lg border border-stone-200/80 bg-white/70 px-2.5 py-1 text-sm font-medium text-stone-600 transition-colors hover:bg-white hover:text-stone-900 dark:border-stone-700/70 dark:bg-stone-900/70 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100"
        >
          Copy link
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-xl shadow-orange-500/10 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <MeowdownEditor
              mode={options.mode}
              spellCheck={
                options.spellcheck === 'default' ? undefined : options.spellcheck === 'on'
              }
              readOnly={options.readonly}
              blockHandle={options.handle}
              caretGlide={options.glide}
              initialMarkdown={initialDoc}
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
        </div>

        {options.source && (
          <div className="flex max-h-[45dvh] min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-xl shadow-orange-500/10 lg:max-h-none dark:border-stone-800 dark:bg-stone-900">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <CodeMirrorPane
                initialDoc={sourceSeed}
                readOnly={options.readonly}
                viewRef={sourceViewRef}
                onBlur={pullFromSource}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Playground() {
  return (
    <NuqsAdapter>
      <PlaygroundApp />
    </NuqsAdapter>
  )
}
