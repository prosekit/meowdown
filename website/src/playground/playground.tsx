import { MeowdownEditor, type EditorHandle } from '@meowdown/react'
import { useQueryStates } from 'nuqs'
import { NuqsAdapter } from 'nuqs/adapters/react'
import { useCallback, useRef, useState } from 'react'

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
import {
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
  preset: parseAsPreset,
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
  const editorRef = useRef<EditorHandle>(null)

  // The editor is uncontrolled: the initial document is resolved once, and
  // later preset switches go through the imperative handle.
  const [initialDoc] = useState(() => getPresetContent(options.preset))

  const selectPreset = useCallback(
    (preset: string) => {
      void setOptions({ preset })
      editorRef.current?.setMarkdown(getPresetContent(preset))
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
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-xl shadow-orange-500/10 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <MeowdownEditor
            mode={options.mode}
            spellCheck={options.spellcheck === 'default' ? undefined : options.spellcheck === 'on'}
            readOnly={options.readonly}
            blockHandle={options.handle}
            caretGlide={options.glide}
            initialMarkdown={initialDoc}
            handleRef={editorRef}
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
