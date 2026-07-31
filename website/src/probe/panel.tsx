import {
  useCallback,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react'

import {
  clearEntries,
  getEntries,
  getEntryCount,
  logAsText,
  record,
  saveRun,
  snapshotSelection,
  subscribe,
} from './recorder.ts'

const PANEL_ROWS = 30
const REFRESH_MS = 250

/**
 * Every probe control uses this: the default `pointerdown` action would blur
 * the editor and destroy the very selection we are recording, so the press is
 * swallowed and the action runs on `click` instead.
 */
export function ProbeButton({
  onPress,
  children,
  tone = 'plain',
}: {
  onPress: () => void
  children: ReactNode
  tone?: 'plain' | 'primary' | 'danger'
}): ReactElement {
  const toneClass =
    tone === 'primary'
      ? 'bg-blue-600 text-white'
      : tone === 'danger'
        ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
        : 'bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-stone-100'
  return (
    <button
      type="button"
      className={`touch-manipulation rounded-lg px-3 py-2 text-sm font-medium ${toneClass}`}
      onPointerDown={(event) => event.preventDefault()}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
    >
      {children}
    </button>
  )
}

/**
 * The human half of the timeline. The loupe, the caret pixels and the iOS grab
 * handles are invisible to JavaScript, so the observer taps them in and they
 * interleave with the events at the right timestamps.
 */
function MarkButtons({ marks }: { marks: readonly string[] }): ReactElement {
  const [note, setNote] = useState('')
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-stone-300 p-3 dark:border-stone-700">
      <h2 className="text-xs font-semibold tracking-wide uppercase opacity-60">看到什么就点什么</h2>
      <div className="flex flex-wrap gap-2">
        {marks.map((mark) => (
          <ProbeButton
            key={mark}
            onPress={() => record('mark', `MARK:${mark}`, undefined, snapshotSelection())}
          >
            {mark}
          </ProbeButton>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-700"
          placeholder="其他观察"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <ProbeButton
          onPress={() => {
            if (note.trim() === '') return
            record('mark', 'MARK:note', { text: note.trim() })
            setNote('')
          }}
        >
          记一笔
        </ProbeButton>
      </div>
    </section>
  )
}

function summarize(detail: Record<string, unknown> | undefined): string {
  if (detail == null) return ''
  const parts: string[] = []
  if (typeof detail.pointerType === 'string') parts.push(detail.pointerType)
  if (typeof detail.key === 'string') parts.push(detail.key)
  if (typeof detail.inputType === 'string') parts.push(detail.inputType)
  if (typeof detail.x === 'number') parts.push(`${detail.x},${String(detail.y)}`)
  if (typeof detail.count === 'number') parts.push(`n=${detail.count}`)
  if (typeof detail.label === 'string') parts.push(detail.label)
  return parts.join(' ')
}

/**
 * Repainting per entry would make the panel itself the busiest thing on the
 * page, so updates coalesce into at most one per `REFRESH_MS`.
 */
function subscribeThrottled(onChange: () => void): () => void {
  let scheduled = false
  let last = 0
  const flush = () => {
    scheduled = false
    const now = performance.now()
    if (now - last < REFRESH_MS) return
    last = now
    onChange()
  }
  return subscribe(() => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(flush)
  })
}

const subscribeNever = () => () => undefined

export function LogPanel(): ReactElement {
  const [paused, setPaused] = useState(false)
  const [status, setStatus] = useState('')
  useSyncExternalStore(paused ? subscribeNever : subscribeThrottled, getEntryCount)

  const save = useCallback(() => {
    setStatus('保存中…')
    void saveRun()
      .then((file) => setStatus(`已保存 ${file}`))
      .catch((error: unknown) => setStatus(`保存失败: ${String(error)}`))
  }, [])

  const copy = useCallback(() => {
    void navigator.clipboard
      .writeText(logAsText())
      .then(() => setStatus('已复制到剪贴板'))
      .catch((error: unknown) => setStatus(`复制失败: ${String(error)}`))
  }, [])

  const entries = paused ? [] : getEntries().slice(-PANEL_ROWS)

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-stone-300 p-3 dark:border-stone-700">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">日志 {getEntryCount()} 条</span>
        <ProbeButton onPress={save} tone="primary">
          保存日志
        </ProbeButton>
        <ProbeButton onPress={copy}>复制</ProbeButton>
        <ProbeButton onPress={() => setPaused((value) => !value)}>
          {paused ? '恢复显示' : '暂停显示'}
        </ProbeButton>
        <ProbeButton
          onPress={() => {
            clearEntries()
            setStatus('已清空')
          }}
          tone="danger"
        >
          清空
        </ProbeButton>
      </div>
      {status !== '' && <p className="text-xs opacity-70">{status}</p>}
      <div
        className="h-48 overflow-auto rounded-lg bg-stone-100 p-2 font-mono text-[11px] leading-tight dark:bg-stone-900"
        style={{ contain: 'strict' }}
      >
        {entries.map((entry) => (
          <div key={entry.seq} className="whitespace-nowrap">
            <span className="opacity-50">{entry.seq}</span>{' '}
            <span className="opacity-50">{entry.t.toFixed(0)}</span>{' '}
            <span className={entry.kind === 'mark' ? 'font-bold text-blue-600' : ''}>
              {entry.name}
            </span>{' '}
            <span className="opacity-70">{summarize(entry.detail)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export interface ProbePageProps {
  title: string
  goal: string
  steps: readonly string[]
  marks: readonly string[]
  controls?: ReactNode
  children: ReactNode
}

export function ProbePage({
  title,
  goal,
  steps,
  marks,
  controls,
  children,
}: ProbePageProps): ReactElement {
  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <header className="flex flex-col gap-1">
        <a href="#/" className="text-sm text-blue-600">
          ← 返回目录
        </a>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm opacity-70">{goal}</p>
      </header>

      <section className="rounded-xl border border-stone-300 p-3 dark:border-stone-700">
        <h2 className="mb-2 text-xs font-semibold tracking-wide uppercase opacity-60">操作步骤</h2>
        <ol className="list-decimal pl-5 text-sm leading-relaxed">
          {/* The position carries the key: a static list where two steps can
              read identically ("点观察按钮。" twice on the selection page). */}
          {steps.map((step, index) => (
            <li key={`${index}:${step}`}>{step}</li>
          ))}
        </ol>
      </section>

      {controls}

      <section className="rounded-xl border border-stone-300 dark:border-stone-700">
        {children}
      </section>

      <MarkButtons marks={marks} />
      <LogPanel />
    </div>
  )
}
