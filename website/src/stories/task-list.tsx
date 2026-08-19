import './stories.css'

import { Priority } from '@meowdown/core'
import { MarkdownView, MeowdownEditor, useKeymap, type EditorHandle } from '@meowdown/react'
import { clsx } from 'clsx/lite'
import { useCallback, useMemo, useRef, useState } from 'react'

import { useMounted } from '../lib/use-mounted.ts'

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
    <div className="story-task-content">
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
    setTasks((current) =>
      current.map((task) => (task.id === id && text !== '' ? { ...task, text } : task)),
    )
  }, [])

  const toggleDone = useCallback((id: number) => {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    )
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
    <div className="story-frame">
      <h2 className="story-task-heading">Tasks</h2>
      <ul className="story-task-list">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={clsx(
              'story-task-row',
              task.id === editingId && 'is-editing',
              task.done && 'is-done',
            )}
          >
            <button
              type="button"
              aria-label={task.done ? 'Mark as open' : 'Mark as done'}
              className="story-task-toggle"
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
                className="story-task-content"
                onClick={() => setEditingId(task.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') setEditingId(task.id)
                }}
              >
                <MarkdownView markdown={task.text} className="story-task-preview" />
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="story-task-hint">
        Click a row to edit it. Enter commits, Escape cancels, ArrowUp and ArrowDown move between
        rows.
      </p>
    </div>
  )
}
