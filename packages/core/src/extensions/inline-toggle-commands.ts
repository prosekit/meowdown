import { defineCommands, defineKeymap, union } from '@prosekit/core'
import type { Command, EditorState, Transaction } from '@prosekit/pm/state'
import { TextSelection } from '@prosekit/pm/state'

import type { TextEdit, ToggleSpec } from './inline-toggle.ts'
import {
  caretPlan,
  isInlineActive,
  TOGGLE_SPECS,
  toggleInlineEdits,
  trimRange,
} from './inline-toggle.ts'

/** Per-textblock slice of the selection, in text-offset space. */
interface Segment {
  text: string
  base: number
  from: number
  to: number
  active: boolean
}

function toggleInline(spec: ToggleSpec): Command {
  return (state, dispatch) => {
    if (state.selection.empty) return caretToggle(spec, state, dispatch)

    const { from, to, anchor, head } = state.selection
    const segments: Segment[] = []
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.spec.code) return false
      if (!node.isTextblock) return true
      const text = node.textContent
      const base = pos + 1
      const [textFrom, textTo] = trimRange(
        text,
        Math.max(from - base, 0),
        Math.min(to - base, text.length),
      )
      if (textFrom < textTo) {
        segments.push({
          text,
          base,
          from: textFrom,
          to: textTo,
          active: isInlineActive(text, textFrom, textTo, spec),
        })
      }
      return false
    })

    const remove = segments.length > 0 && segments.every((segment) => segment.active)
    const edits: TextEdit[] = segments
      .filter((segment) => remove || !segment.active)
      .flatMap((segment) =>
        toggleInlineEdits(segment.text, segment.from, segment.to, spec, remove).map((edit) => ({
          from: edit.from + segment.base,
          to: edit.to + segment.base,
          insert: edit.insert,
        })),
      )
    if (edits.length === 0) return false

    if (dispatch) {
      const tr = state.tr
      // Right-to-left keeps every edit position valid without remapping;
      // on a position tie the deletion must run before the insertion.
      edits.sort((left, right) => right.from - left.from || right.to - left.to)
      for (const edit of edits) {
        if (edit.insert) tr.insertText(edit.insert, edit.from, edit.to)
        else tr.delete(edit.from, edit.to)
      }
      tr.setSelection(
        TextSelection.create(
          tr.doc,
          tr.mapping.map(anchor, anchor <= head ? 1 : -1),
          tr.mapping.map(head, head < anchor ? 1 : -1),
        ),
      )
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

function caretToggle(
  spec: ToggleSpec,
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const { $from } = state.selection
  const block = $from.parent
  if (!block.isTextblock || block.type.spec.code) return false
  const plan = caretPlan(block.textContent, $from.parentOffset, spec)
  if (!plan) return false
  if (dispatch) {
    const base = $from.start()
    const tr = state.tr
    if (plan.kind === 'unwrap') tr.delete(base + plan.from, base + plan.to)
    if (plan.kind === 'move') tr.setSelection(TextSelection.create(tr.doc, base + plan.pos))
    if (plan.kind === 'insert') {
      tr.insertText(spec.delim + spec.delim, base + plan.pos)
      tr.setSelection(TextSelection.create(tr.doc, base + plan.pos + spec.delim.length))
    }
    dispatch(tr.scrollIntoView())
  }
  return true
}

function defineInlineToggleCommands() {
  return defineCommands({
    toggleEm: () => toggleInline(TOGGLE_SPECS.em),
    toggleStrong: () => toggleInline(TOGGLE_SPECS.strong),
    toggleCode: () => toggleInline(TOGGLE_SPECS.code),
    toggleDel: () => toggleInline(TOGGLE_SPECS.del),
  })
}

function defineInlineToggleKeymap() {
  return defineKeymap({
    'Mod-b': toggleInline(TOGGLE_SPECS.strong),
    'Mod-i': toggleInline(TOGGLE_SPECS.em),
    'Mod-e': toggleInline(TOGGLE_SPECS.code),
    'Mod-Shift-x': toggleInline(TOGGLE_SPECS.del),
  })
}

export function defineInlineToggle() {
  return union(defineInlineToggleCommands(), defineInlineToggleKeymap())
}
