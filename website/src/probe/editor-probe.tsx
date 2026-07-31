import { useEditor, useExtension } from '@meowdown/react'
import { definePlugin, type PlainExtension } from '@prosekit/core'
import { Plugin, PluginKey, type Transaction } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'
import { useEffect, useMemo, type ReactElement } from 'react'

import { attachProbe } from './attach.ts'
import { record, setSelectionProvider, type SelectionSnapshot } from './recorder.ts'

const probeKey = new PluginKey('meowdown-probe-transactions')

let currentView: EditorView | undefined

/** The live view, for the pages that drive measurements from a button. */
export function getProbeView(): EditorView | undefined {
  return currentView
}

function pmSnapshot(): SelectionSnapshot['pm'] {
  const view = currentView
  if (view == null || view.isDestroyed) return undefined
  const selection = view.state.selection
  const $head = selection.$head
  return {
    anchor: selection.anchor,
    head: selection.head,
    empty: selection.empty,
    type: selection.constructor.name,
    parent: $head.parent.type.name,
    parentOffset: $head.parentOffset,
    marks: $head.marks().map((mark) => mark.type.name),
  }
}

// Transaction metas are the only way to see WHY the selection moved: a pointer
// selection carries prosemirror-view's `pointer` meta, and the hide-mode snap
// plugin appends its own transaction on top.
function metaKeys(tr: Transaction): string[] {
  const holder = tr as unknown as { meta?: Record<string, unknown> }
  return holder.meta == null ? [] : Object.keys(holder.meta)
}

function defineTransactionProbe(): PlainExtension {
  return definePlugin(
    new Plugin({
      key: probeKey,
      appendTransaction: (transactions, oldState, newState) => {
        record('tx', 'transactions', {
          count: transactions.length,
          transactions: transactions.map((tr) => ({
            docChanged: tr.docChanged,
            selectionSet: tr.selectionSet,
            steps: tr.steps.length,
            stepTypes: tr.steps.map((step) => step.constructor.name),
            meta: metaKeys(tr),
            scrolledIntoView: tr.scrolledIntoView,
          })),
          from: { anchor: oldState.selection.anchor, head: oldState.selection.head },
          to: { anchor: newState.selection.anchor, head: newState.selection.head },
          selectionType: newState.selection.constructor.name,
        })
        return null
      },
    }),
  )
}

export interface EditorProbeProps {
  /** Record every pointermove / touchmove / mousemove. */
  trackMoves?: boolean
}

/**
 * The leaf that wires the probe into a Meowdown editor: it owns the view
 * reference, the transaction tap, and the DOM event tap on `view.dom`. Render
 * it as a child of `MeowdownEditor`.
 */
export function EditorProbe({ trackMoves = true }: EditorProbeProps): ReactElement | null {
  const editor = useEditor({ update: false })
  useExtension(useMemo(() => defineTransactionProbe(), []))

  useEffect(() => {
    const view = editor.view
    currentView = view
    setSelectionProvider(pmSnapshot)
    record('note', 'editor-mounted', { docSize: view.state.doc.content.size })
    const detach = attachProbe(view.dom, { trackMoves })
    return () => {
      detach()
      setSelectionProvider(undefined)
      currentView = undefined
    }
  }, [editor, trackMoves])

  return null
}
