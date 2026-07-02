import { defineCommands } from '@prosekit/core'
import { Slice, type ResolvedPos } from '@prosekit/pm/model'
import { TextSelection, type Command } from '@prosekit/pm/state'

import { markdownToDoc } from '../converters/md-to-pm.ts'

import { getNodeBuildersForSchema } from './schema.ts'

function selectText(anchor: number, head?: number): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const selection = TextSelection.create(state.doc, anchor, head)
      const tr = state.tr.setSelection(selection)
      dispatch(tr)
    }
    return true
  }
}

function selectTextBetween($anchor: ResolvedPos, $head: ResolvedPos, bias?: number): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const selection = TextSelection.between($anchor, $head, bias)
      const tr = state.tr.setSelection(selection)
      dispatch(tr)
    }
    return true
  }
}

function insertMarkdown(markdown: string): Command {
  return (state, dispatch) => {
    if (!markdown.trim()) return false
    const nodes = getNodeBuildersForSchema(state.schema)
    const content = markdownToDoc(markdown, { nodes }).content
    const isLoneParagraph =
      content.childCount === 1 && content.firstChild?.type.name === 'paragraph'
    const slice = isLoneParagraph
      ? new Slice(content, 1, 1)
      : new Slice(content, 0, Slice.maxOpen(content).openEnd)
    if (dispatch) dispatch(state.tr.replaceSelection(slice).scrollIntoView())
    return true
  }
}

export function defineEditorCommands() {
  return defineCommands({
    insertMarkdown,
    selectText,
    selectTextBetween,
  })
}
