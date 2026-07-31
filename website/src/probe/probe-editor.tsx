import { MeowdownEditor, type EditorMode } from '@meowdown/react'
import { useEffect, useState, type ReactElement } from 'react'

import { EditorProbe } from './editor-probe.tsx'
import { ProbeButton } from './panel.tsx'
import { record, setConfig as setRecorderConfig } from './recorder.ts'

/**
 * How the caret is drawn. `virtual` is the shipped behavior; the other three
 * exist to attribute the missing iOS magnifier.
 *
 * - `native`: virtual caret hidden, native caret restored.
 * - `both`: both drawn, so a position disagreement is visible on screen.
 * - `faint`: virtual caret drawn and the native one painted in an almost
 *   invisible color instead of `transparent`. If the magnifier comes back here
 *   but not under `transparent`, we have a way to keep both.
 */
export type CaretRendering = 'virtual' | 'native' | 'both' | 'faint'

const CARET_RENDERINGS: readonly CaretRendering[] = ['virtual', 'native', 'both', 'faint']
const MARK_MODES: readonly EditorMode[] = ['hide', 'focus', 'show']

export interface CaretConfig {
  rendering: CaretRendering
  markMode: EditorMode
}

export function useCaretConfig(initial?: Partial<CaretConfig>): {
  config: CaretConfig
  setRendering: (rendering: CaretRendering) => void
  setMarkMode: (markMode: EditorMode) => void
} {
  const [config, setConfig] = useState<CaretConfig>({
    rendering: initial?.rendering ?? 'virtual',
    markMode: initial?.markMode ?? 'hide',
  })

  useEffect(() => {
    setRecorderConfig({ ...config })
    record('config', 'caret-config', { ...config })
  }, [config])

  return {
    config,
    setRendering: (rendering) => setConfig((value) => ({ ...value, rendering })),
    setMarkMode: (markMode) => setConfig((value) => ({ ...value, markMode })),
  }
}

export function CaretControls({
  config,
  setRendering,
  setMarkMode,
}: ReturnType<typeof useCaretConfig>): ReactElement {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-stone-300 p-3 dark:border-stone-700">
      <h2 className="text-xs font-semibold tracking-wide uppercase opacity-60">开关</h2>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm opacity-70">caret</span>
        {CARET_RENDERINGS.map((rendering) => (
          <ProbeButton
            key={rendering}
            tone={config.rendering === rendering ? 'primary' : 'plain'}
            onPress={() => setRendering(rendering)}
          >
            {rendering}
          </ProbeButton>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm opacity-70">mode</span>
        {MARK_MODES.map((markMode) => (
          <ProbeButton
            key={markMode}
            tone={config.markMode === markMode ? 'primary' : 'plain'}
            onPress={() => setMarkMode(markMode)}
          >
            {markMode}
          </ProbeButton>
        ))}
      </div>
    </section>
  )
}

export interface ProbeEditorProps {
  markdown: string
  markMode?: EditorMode
  rendering?: CaretRendering
  trackMoves?: boolean
}

export function ProbeEditor({
  markdown,
  markMode = 'hide',
  rendering = 'virtual',
  trackMoves = true,
}: ProbeEditorProps): ReactElement {
  return (
    <div className={`probe-caret-${rendering} min-h-56`}>
      {/* Remounting on a mode change is deliberate: mark mode is a creation-time
          extension, and a fresh editor keeps every run comparable. */}
      <MeowdownEditor key={markMode} mode={markMode} initialMarkdown={markdown}>
        <EditorProbe trackMoves={trackMoves} />
      </MeowdownEditor>
    </div>
  )
}
