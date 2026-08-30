import './stories.css'

import { Priority } from '@meowdown/core'
import { MarkdownView, MeowdownEditor, useKeymap, type EditorHandle } from '@meowdown/react'
import { clsx } from 'clsx/lite'
import { useCallback, useMemo, useRef, useState } from 'react'

import { useMounted } from '../lib/use-mounted.ts'

// Both the preview and the one-line editor render a .ProseMirror root; the
// zeroed reading gutter keeps the row compact and the swap jump-free.
const taskContentClass =
  'min-w-0 flex-1 cursor-pointer text-sm leading-6 [&_p]:m-0 [&_.ProseMirror]:p-0!'

interface Task {
  id: number
  text: string
  done: boolean
}

const INITIAL_TASKS: Task[] = [
  { id: 1, text: 'Review the **playground** PR', done: false },
  { id: 2, text: 'Test spellcheck inside `code spans`', done: false },
  { id: 3, text: 'File the WebKit ArrowLeft bug upstream', done: true },
  { id: 4, text: 'Ship [[Daily notes]] to #beta', done: false },
]

// Children of MeowdownEditor render inside the ProseKit context, which is what
// lets useKeymap claim keys; high priority outranks the editor's own bindings.
function TaskKeymap({
  onCommit,
  onCancel,
  onMove,
}: {
  onCommit: () => void
  onCancel: () => void
  onMove: (delta: -1 | 1) => void
}): null {
  const keymap = useMemo(
    () => ({
      Enter: () => {
        onCommit()
        return true
      },
      Escape: () => {
        onCancel()
        return true
      },
      ArrowUp: () => {
        onMove(-1)
        return true
      },
      ArrowDown: () => {
        onMove(1)
        return true
      },
    }),
    [onCommit, onCancel, onMove],
  )
  useKeymap(keymap, { priority: Priority.high })
  return null
}

function TaskEditor({
  task,
  onCommit,
  onCancel,
  onMove,
}: {
  task: Task
  onCommit: (text: string) => void
  onCancel: () => void
  onMove: (delta: -1 | 1, text: string) => void
}) {
  const handleRef = useRef<EditorHandle | null>(null)

  const attachHandle = useCallback((handle: EditorHandle | null) => {
    handleRef.current = handle
    if (handle) {
      handle.focus()
      handle.setSelection('end')
    }
  }, [])

  const readText = useCallback(
    () => handleRef.current?.getMarkdown().trim() ?? task.text,
    [task.text],
  )

  const commit = useCallback(() => onCommit(readText()), [onCommit, readText])
  const move = useCallback((delta: -1 | 1) => onMove(delta, readText()), [onMove, readText])

  return (
    <div className={taskContentClass}>
      <MeowdownEditor
        initialMarkdown={task.text}
        mode="hide"
        blockHandle={false}
        handleRef={attachHandle}
      >
        <TaskKeymap onCommit={commit} onCancel={onCancel} onMove={move} />
      </MeowdownEditor>
    </div>
  )
}

export function TaskList() {
  const mounted = useMounted()
  const [tasks, setTasks] = useState(INITIAL_TASKS)
  const [editingId, setEditingId] = useState<number | undefined>(undefined)

  const updateTask = useCallback((id: number, text: string) => {
    setTasks((current) => {
      return current.map((task) => (task.id === id && text !== '' ? { ...task, text } : task))
    })
  }, [])

  const toggleDone = useCallback((id: number) => {
    setTasks((current) => {
      return current.map((task) => (task.id === id ? { ...task, done: !task.done } : task))
    })
  }, [])

  if (!mounted) return null

  const editingIndex = tasks.findIndex((task) => task.id === editingId)

  const moveEditing = (delta: -1 | 1, text: string) => {
    if (editingId != null) {
      updateTask(editingId, text)
    }
    const nextTask = tasks[editingIndex + delta]
    setEditingId(nextTask ? nextTask.id : undefined)
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h2 className="mb-2 text-xl font-[650] text-stone-900 dark:text-stone-50">Tasks</h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={clsx(
              'flex min-h-10 items-start gap-3 border-0 border-b border-solid border-black/8 px-3 py-2 dark:border-white/12',
              task.id === editingId && 'bg-amber-600/8 dark:bg-amber-400/8',
            )}
          >
            <button
              type="button"
              aria-label={task.done ? 'Mark as open' : 'Mark as done'}
              className={clsx(
                // h-6 matches the content's line height, so the toggle centers
                // on the first line even when a task wraps.
                'flex h-6 cursor-pointer items-center border-none bg-transparent p-0 text-base',
                task.done
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-stone-500 dark:text-stone-400',
              )}
              onClick={() => toggleDone(task.id)}
            >
              {task.done ? '●' : '○'}
            </button>
            {task.id === editingId ? (
              <TaskEditor
                task={task}
                onCommit={(text) => {
                  updateTask(task.id, text)
                  setEditingId(undefined)
                }}
                onCancel={() => setEditingId(undefined)}
                onMove={moveEditing}
              />
            ) : (
              <div
                role="button"
                tabIndex={0}
                className={taskContentClass}
                onClick={() => setEditingId(task.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') setEditingId(task.id)
                }}
              >
                <MarkdownView
                  markdown={task.text}
                  className={clsx('pointer-events-none', task.done && 'line-through opacity-60')}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.8125rem] text-stone-500 dark:text-stone-400">
        Click a row to edit it. Enter commits, Escape cancels, ArrowUp and ArrowDown move between
        rows.
      </p>
    </div>
  )
}
