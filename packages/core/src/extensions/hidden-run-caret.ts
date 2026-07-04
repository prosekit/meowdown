import {
  defineKeymap,
  definePlugin,
  isTextSelection,
  Priority,
  union,
  withPriority,
  type PlainExtension,
} from '@prosekit/core'
import type { Command } from '@prosekit/pm/state'
import { Plugin, PluginKey, TextSelection } from '@prosekit/pm/state'

import {
  getHiddenRunAfter,
  getHiddenRunAround,
  getHiddenRunBefore,
  getRestPosition,
  getUnitMarkerRuns,
} from './hidden-run.ts'
import { getMarkMode } from './mark-mode.ts'

const snapKey = new PluginKey('meowdown-hidden-run-snap')
const beforeInputKey = new PluginKey('meowdown-hidden-run-beforeinput')

// Keeps the hide-mode caret on rest positions, whatever moved it: arrow keys,
// clicks, vertical motion, Home/End, shift-extension, or programmatic
// setSelection. Keyboard motion continues through a run interior in the travel
// direction; a pointer caret snaps to the unit's outer edge; a range selection
// expands outward so it never cuts a run in half.
function createSnapPlugin(): Plugin {
  let composing = false
  return new Plugin({
    key: snapKey,
    props: {
      handleDOMEvents: {
        compositionstart: () => {
          composing = true
          return false
        },
        compositionend: () => {
          composing = false
          return false
        },
      },
    },
    appendTransaction: (transactions, oldState, newState) => {
      if (composing) return null
      if (getMarkMode(newState) !== 'hide') return null
      const selection = newState.selection
      if (!isTextSelection(selection)) return null
      // prosemirror-view tags pointer-originated selections with this meta in
      // its input handling (`updateSelection` in input.ts).
      const isPointer = transactions.some((tr) => tr.getMeta('pointer') != null)
      if (selection.empty) {
        const next = getRestPosition(newState, oldState.selection.head, selection.head, isPointer)
        if (next === selection.head) return null
        return newState.tr.setSelection(TextSelection.create(newState.doc, next))
      }
      const from = getHiddenRunAround(newState, selection.from)?.from ?? selection.from
      const to = getHiddenRunAround(newState, selection.to)?.to ?? selection.to
      if (from === selection.from && to === selection.to) return null
      const anchor = selection.anchor === selection.from ? from : to
      const head = selection.head === selection.from ? from : to
      return newState.tr.setSelection(TextSelection.create(newState.doc, anchor, head))
    },
  })
}

// Move the caret to the unit's outer edge and decline the key, so the regular
// Enter chain (flat-list, base keymap) performs the split there. A split can
// then never separate a unit from half of its markers.
const relocateEnterSplit: Command = (state, dispatch) => {
  if (getMarkMode(state) !== 'hide') return false
  const selection = state.selection
  if (!isTextSelection(selection) || !selection.empty) return false
  const outer = getRestPosition(state, selection.head, selection.head, true)
  if (outer === selection.head) return false
  dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, outer)))
  return false
}

// Deleting into a hidden run dissolves the run's unit: both marker runs go,
// the content stays. The adjacent marker character selects WHICH unit
// dissolves when runs of adjacent units merge. `getUnitMarkerRuns` returns the
// trailing run first, so the deletions never need remapping.
function createUnformatCommand(direction: -1 | 1): Command {
  return (state, dispatch) => {
    if (getMarkMode(state) !== 'hide') return false
    const selection = state.selection
    if (!isTextSelection(selection) || !selection.empty) return false
    const $head = selection.$head
    if (!$head.parent.isTextblock || $head.parent.type.spec.code) return false
    const run =
      direction === -1
        ? getHiddenRunBefore(state, selection.head)
        : getHiddenRunAfter(state, selection.head)
    if (run == null) return false
    const markerChar = direction === -1 ? run.to - 1 : run.from
    const markerRuns = getUnitMarkerRuns(state, markerChar)
    const tr = state.tr
    if (markerRuns.length === 0) {
      tr.delete(run.from, run.to)
    } else {
      for (const markerRun of markerRuns) {
        tr.delete(markerRun.from, markerRun.to)
      }
    }
    dispatch?.(tr)
    return true
  }
}

const backspaceUnformat = createUnformatCommand(-1)
const deleteUnformat = createUnformatCommand(1)

// Virtual keyboards deliver deletion as beforeinput without a matching
// keydown, so the keymap never sees it. Chrome Android fires these
// uncancelable; there the native per-char deletion proceeds and the reparse
// plus the snap keep the result consistent.
function createBeforeInputPlugin(): Plugin {
  return new Plugin({
    key: beforeInputKey,
    props: {
      handleDOMEvents: {
        beforeinput: (view, event) => {
          if (view.composing) return false
          const command =
            event.inputType === 'deleteContentBackward'
              ? backspaceUnformat
              : event.inputType === 'deleteContentForward'
                ? deleteUnformat
                : undefined
          if (command == null) return false
          if (!command(view.state, view.dispatch)) return false
          event.preventDefault()
          return true
        },
      },
    },
  })
}

export function defineHiddenRunCaret(): PlainExtension {
  return union(
    definePlugin(createSnapPlugin()),
    definePlugin(createBeforeInputPlugin()),
    withPriority(
      defineKeymap({
        Enter: relocateEnterSplit,
        Backspace: backspaceUnformat,
        Delete: deleteUnformat,
      }),
      Priority.highest,
    ),
  )
}
