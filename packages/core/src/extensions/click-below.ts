import { defaultBlockAt, definePlugin, type PlainExtension } from '@prosekit/core'
import type { ProseMirrorNode } from '@prosekit/pm/model'
import { Plugin, PluginKey, TextSelection } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'

import { isNodeOfType } from './node-names.ts'

const clickBelowKey = new PluginKey('meowdown-click-below')

// A plain textblock already takes the caret from a click below it.
function acceptsCaretAtEnd(node: ProseMirrorNode): boolean {
  return node.isTextblock && !node.type.spec.code
}

// A folded list hides its children with `display: none`, so they have no
// client rects.
function isRendered(view: EditorView, pos: number): boolean {
  const dom = view.nodeDOM(pos)
  return dom instanceof HTMLElement && dom.getClientRects().length > 0
}

/**
 * Returns the end of the last rendered textblock inside `node`, whose content
 * starts at `contentStart`. Hidden subtrees are skipped.
 */
function findLastRenderedLineEnd(
  view: EditorView,
  node: ProseMirrorNode,
  contentStart: number,
): number | undefined {
  let end = contentStart + node.content.size
  for (let i = node.childCount - 1; i >= 0; i--) {
    const child = node.child(i)
    const pos = end - child.nodeSize
    end = pos
    if (!isRendered(view, pos)) continue
    if (child.isTextblock) return pos + child.nodeSize - 1
    const found = findLastRenderedLineEnd(view, child, pos + 1)
    if (found != null) return found
  }
  return undefined
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

  const lastBlockPos = doc.content.size - lastBlock.nodeSize
  let bottom: ProseMirrorNode = lastBlock
  let bottomPos = lastBlockPos
  while (!bottom.isTextblock && !isNodeOfType(bottom, 'table') && bottom.lastChild) {
    const child: ProseMirrorNode = bottom.lastChild
    bottomPos += bottom.nodeSize - 1 - child.nodeSize
    bottom = child
  }
  const bottomIsEmptyLine =
    bottom.isTextblock && bottom.content.size === 0 && acceptsCaretAtEnd(bottom)

  // A rendered empty bottom line, such as a fresh bullet, already takes the caret.
  if (bottomIsEmptyLine && isRendered(view, bottomPos)) return false

  const lastBlockDOM = view.nodeDOM(lastBlockPos)
  if (!(lastBlockDOM instanceof HTMLElement)) return false
  if (event.clientY <= lastBlockDOM.getBoundingClientRect().bottom) return false

  // A hidden empty bottom line, such as the child of a folded bullet, gives the
  // caret to the last rendered line.
  if (bottomIsEmptyLine) {
    const end = findLastRenderedLineEnd(view, doc, 0)
    if (end == null) return false
    event.preventDefault()
    view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, end)).scrollIntoView())
    view.focus()
    return true
  }

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
 * in it, when that block would otherwise keep the caret inside itself and
 * does not end in an empty line. When that empty line is hidden, the caret
 * goes to the end of the last rendered line.
 */
export function defineClickBelow(): PlainExtension {
  return definePlugin(
    new Plugin({
      key: clickBelowKey,
      props: { handleDOMEvents: { mousedown: handleMouseDown } },
    }),
  )
}
