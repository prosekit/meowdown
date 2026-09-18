import { defaultBlockAt, definePlugin, type PlainExtension } from '@prosekit/core'
import type { ProseMirrorNode } from '@prosekit/pm/model'
import { Plugin, PluginKey, TextSelection } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

const clickBelowKey = new PluginKey('meowdown-click-below')

// A plain textblock already takes the caret from a click below it.
function acceptsCaretAtEnd(node: ProseMirrorNode): boolean {
  return node.isTextblock && !node.type.spec.code
}

function handleMouseDown(view: EditorView, event: MouseEvent): boolean {
  // A press on any block targets that block's DOM. Only a press on the
  // editor's own box (its padding, the gaps between blocks, the space below
  // them) targets the editor element.
  if (event.target !== view.dom) return false
  if (event.button !== 0 || !view.editable) return false

  const { doc } = view.state
  const lastBlock = doc.lastChild
  if (!lastBlock || acceptsCaretAtEnd(lastBlock)) return false

  const lastBlockDOM = view.nodeDOM(doc.content.size - lastBlock.nodeSize)
  if (!(lastBlockDOM instanceof HTMLElement)) return false
  if (event.clientY <= lastBlockDOM.getBoundingClientRect().bottom) return false

  const block = defaultBlockAt(doc.contentMatchAt(doc.childCount))?.createAndFill()
  if (!block) return false

  event.preventDefault()
  const end = doc.content.size
  const tr = view.state.tr.insert(end, block)
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, end + 1)).scrollIntoView())
  view.focus()
  return true
}

/**
 * A press below the last block appends an empty paragraph and puts the caret
 * in it, when that block would otherwise keep the caret inside itself.
 */
export function defineClickBelow(): PlainExtension {
  return definePlugin(
    new Plugin({
      key: clickBelowKey,
      props: { handleDOMEvents: { mousedown: handleMouseDown } },
    }),
  )
}
