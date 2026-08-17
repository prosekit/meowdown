import './stories.css'

import type { ExitBoundaryHandler } from '@meowdown/core'
import { MeowdownEditor, type EditorHandle } from '@meowdown/react'
import { clsx } from 'clsx/lite'
import { useCallback, useMemo, useRef } from 'react'

import { useMounted } from './use-mounted.ts'

const PAST_DAYS = 5
const FUTURE_DAYS = 1

const DAY_SEEDS: Record<number, string> = {
  [-3]: '- [x] Ship the drawer migration\n- Called the plumber about the kitchen sink',
  [-1]: '## Reading\n\nStarted *The Design of Everyday Things*. The section on [[Affordances]] maps nicely to #editor work.',
  [0]: '- [ ] Review the meowdown playground PR\n- [ ] Water the plants #home',
}

const DAY_LABEL_FORMAT = new Intl.DateTimeFormat('en', {
  weekday: 'short',
  month: 'long',
  day: 'numeric',
})

function formatDayLabel(offset: number, date: Date): string {
  const label = DAY_LABEL_FORMAT.format(date)
  return offset === 0 ? `${label} (today)` : label
}

function DailyNoteRow({
  offset,
  date,
  registerHandle,
  focusDay,
}: {
  offset: number
  date: Date
  registerHandle: (offset: number, handle: EditorHandle | null) => void
  focusDay: (offset: number, position: 'start' | 'end') => boolean
}) {
  const handleRef = useCallback(
    (handle: EditorHandle | null) => registerHandle(offset, handle),
    [registerHandle, offset],
  )

  // ArrowUp on the first line moves to the end of the previous day, ArrowDown
  // on the last line to the start of the next one. `focusDay` returns false at
  // the stream's edges, handing the key back to the editor.
  const handleExitBoundary: ExitBoundaryHandler = useCallback(
    ({ direction }) =>
      focusDay(direction === 'up' ? offset - 1 : offset + 1, direction === 'up' ? 'end' : 'start'),
    [focusDay, offset],
  )

  return (
    <section className="story-day">
      <h2
        className={clsx('story-day-subject', offset === 0 && 'is-today')}
        onClick={() => focusDay(offset, 'start')}
      >
        {formatDayLabel(offset, date)}
      </h2>
      <MeowdownEditor
        initialMarkdown={DAY_SEEDS[offset] ?? ''}
        handleRef={handleRef}
        editorClassName={offset < 0 ? 'story-day-editor-past' : 'story-day-editor-today'}
        onExitBoundary={handleExitBoundary}
      />
    </section>
  )
}

export function DailyNotes() {
  const mounted = useMounted()
  const handlesRef = useRef(new Map<number, EditorHandle>())

  const days = useMemo(() => {
    const today = new Date()
    return Array.from({ length: PAST_DAYS + FUTURE_DAYS + 1 }, (_, index) => {
      const offset = index - PAST_DAYS
      const date = new Date(today)
      date.setDate(today.getDate() + offset)
      return { offset, date }
    })
  }, [])

  const registerHandle = useCallback((offset: number, handle: EditorHandle | null) => {
    if (handle) {
      handlesRef.current.set(offset, handle)
    } else {
      handlesRef.current.delete(offset)
    }
  }, [])

  const focusDay = useCallback((offset: number, position: 'start' | 'end'): boolean => {
    const handle = handlesRef.current.get(offset)
    if (!handle) return false
    handle.focus()
    // meowdown's setSelection also scrolls the caret into view.
    handle.setSelection(position)
    return true
  }, [])

  if (!mounted) return null

  return (
    <div className="story-frame">
      {days.map(({ offset, date }) => (
        <DailyNoteRow
          key={offset}
          offset={offset}
          date={date}
          registerHandle={registerHandle}
          focusDay={focusDay}
        />
      ))}
    </div>
  )
}
