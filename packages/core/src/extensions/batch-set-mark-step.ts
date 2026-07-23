import { Fragment, Mark, type EditorNode, type Schema } from '@prosekit/pm/model'
import type { Mappable } from '@prosekit/pm/transform'
import { ReplaceStep, Step, StepResult, Transform } from '@prosekit/pm/transform'

import {
  markChunkFromJSON,
  markChunkToJSON,
  type MarkChunk,
  type MarkChunkJSON,
} from './mark-chunk.ts'
import { marksEqual } from './marks-equal.ts'

interface BatchSetMarkStepJSON {
  stepType: 'batchSetMark'
  chunks: MarkChunkJSON[]
}

const SPARSE_CHUNK_LIMIT = 32

/**
 * Apply a small batch by visiting each chunk's narrow range independently.
 * This avoids rebuilding a shared ancestor when an ordinary edit produces only
 * a handful of distant mark changes.
 */
function applySparseChunks(doc: EditorNode, chunks: readonly MarkChunk[]): StepResult {
  const docSize = doc.content.size
  let transform: Transform | undefined

  for (const [from, to, unsortedMarks] of chunks) {
    if (from >= to) continue
    const safeFrom = Math.max(0, Math.min(from, docSize))
    const safeTo = Math.max(safeFrom, Math.min(to, docSize))
    if (safeFrom >= safeTo) continue

    const expected = Mark.setFrom(unsortedMarks)
    doc.nodesBetween(safeFrom, safeTo, (node, position) => {
      if (!node.isText) return true

      const nodeFrom = Math.max(safeFrom, position)
      const nodeTo = Math.min(safeTo, position + node.nodeSize)
      if (nodeFrom >= nodeTo || marksEqual(node.marks, expected)) return false

      // Delay allocation until at least one text node actually differs.
      transform ??= new Transform(doc)
      for (const mark of node.marks) transform.removeMark(nodeFrom, nodeTo, mark)
      for (const mark of expected) transform.addMark(nodeFrom, nodeTo, mark)
      return false
    })
  }

  return StepResult.ok(transform?.doc ?? doc)
}

/**
 * Apply a dense batch in one ordered tree walk. Reference-link restyles can
 * produce hundreds of chunks, where running nodesBetween once per chunk would
 * repeatedly descend through the same document branches.
 */
function applySequentialChunks(doc: EditorNode, chunks: readonly MarkChunk[]): StepResult {
  const docSize = doc.content.size
  // Production chunks are already ordered, but sorting keeps the walk monotonic
  // for deserialized or independently constructed steps.
  const sorted = [...chunks]
    .filter(([from, to]) => from < to && from < docSize)
    .sort((left, right) => left[0] - right[0])
  if (sorted.length === 0) return StepResult.ok(doc)

  const expectedSets = sorted.map(([, , marks]) => Mark.setFrom(marks))
  // Restrict recursion to the smallest document span containing every chunk.
  const first = Math.max(0, sorted[0][0])
  let last = 0
  for (const [, to] of sorted) {
    if (to > last) last = to
  }
  last = Math.min(last, docSize)
  if (first >= last) return StepResult.ok(doc)

  let chunkIndex = 0

  /**
   * Split one text node at chunk boundaries. A piece with undefined marks keeps
   * the source node's marks; a concrete set replaces them.
   */
  function rewriteText(node: EditorNode, nodeFrom: number): EditorNode[] | undefined {
    const nodeTo = nodeFrom + node.nodeSize
    // Text nodes are visited in document order, so completed chunks never need
    // to be considered again.
    while (chunkIndex < sorted.length && sorted[chunkIndex][1] <= nodeFrom) chunkIndex++
    interface Piece {
      from: number
      to: number
      marks: readonly Mark[] | undefined
    }
    const pieces: Piece[] = []
    let cursor = nodeFrom
    let changed = false
    for (let index = chunkIndex; index < sorted.length; index++) {
      const [chunkFrom, chunkTo] = sorted[index]
      if (chunkFrom >= nodeTo) break
      const from = Math.max(chunkFrom, cursor)
      const to = Math.min(chunkTo, nodeTo)
      if (from >= to) continue
      if (from > cursor) pieces.push({ from: cursor, to: from, marks: undefined })
      const expected = expectedSets[index]
      const differs = !marksEqual(node.marks, expected)
      if (differs) changed = true
      pieces.push({ from, to, marks: differs ? expected : undefined })
      cursor = to
    }
    // Preserve the original text node and all ancestor identities on a no-op.
    if (!changed) return
    if (cursor < nodeTo) pieces.push({ from: cursor, to: nodeTo, marks: undefined })
    return pieces.map((piece) => {
      const cut = node.cut(piece.from - nodeFrom, piece.to - nodeFrom)
      return piece.marks == null ? cut : cut.mark(piece.marks)
    })
  }

  /**
   * Rebuild only ancestors containing changed text. Children outside the dense
   * batch's overall span retain their original node identities.
   */
  function rewriteContent(node: EditorNode, contentFrom: number): Fragment | undefined {
    let rebuilt: EditorNode[] | undefined
    let childFrom = contentFrom
    for (let index = 0; index < node.childCount; index++) {
      const child = node.child(index)
      const childTo = childFrom + child.nodeSize
      let replacement: EditorNode | EditorNode[] = child
      if (childTo > first && childFrom < last) {
        if (child.isText) {
          replacement = rewriteText(child, childFrom) ?? child
        } else if (child.childCount > 0) {
          const content = rewriteContent(child, childFrom + 1)
          if (content != null) replacement = child.copy(content)
        }
      }
      // Allocate the replacement array only when the first changed child is
      // found, then copy the untouched prefix once.
      if (replacement !== child && rebuilt == null) {
        rebuilt = []
        for (let seen = 0; seen < index; seen++) rebuilt.push(node.child(seen))
      }
      if (rebuilt != null) {
        if (Array.isArray(replacement)) {
          rebuilt.push(...replacement)
        } else {
          rebuilt.push(replacement)
        }
      }
      childFrom = childTo
    }
    return rebuilt == null ? undefined : Fragment.fromArray(rebuilt)
  }

  const content = rewriteContent(doc, 0)
  return StepResult.ok(content == null ? doc : doc.copy(content))
}

/**
 * One ProseMirror Step that applies a batch of `MarkChunk`s in a single
 * undo entry.
 */
export class BatchSetMarkStep extends Step {
  readonly chunks: readonly MarkChunk[]

  constructor(chunks: readonly MarkChunk[]) {
    super()
    this.chunks = chunks
  }

  apply(doc: EditorNode): StepResult {
    if (this.chunks.length === 0) return StepResult.ok(doc)
    // Sparse edits favor independent narrow traversals. Dense reference
    // restyles favor one range-pruned sequential traversal.
    if (this.chunks.length <= SPARSE_CHUNK_LIMIT) {
      return applySparseChunks(doc, this.chunks)
    }
    return applySequentialChunks(doc, this.chunks)
  }

  invert(doc: EditorNode): Step {
    if (this.chunks.length === 0) {
      return emptyBatchSetMarkStep
    }
    const overallFrom = this.chunks[0][0]
    let overallTo = this.chunks[0][1]
    for (const [, to] of this.chunks) {
      if (to > overallTo) overallTo = to
    }
    const docSize = doc.content.size
    const safeFrom = Math.max(0, Math.min(overallFrom, docSize))
    const safeTo = Math.max(safeFrom, Math.min(overallTo, docSize))
    const slice = doc.slice(safeFrom, safeTo)
    return new ReplaceStep(safeFrom, safeTo, slice, false)
  }

  /**
   * Returns `null`: in a collaborative-editing rebase the chunk
   * positions may no longer line up with text-block boundaries. The
   * inline-mark plugin re-derives chunks on every `appendTransaction`,
   * so dropping the step on rebase is safe. It will be regenerated on
   * the next dispatch.
   */
  map(_mapping: Mappable): Step | null {
    return null
  }

  toJSON(): BatchSetMarkStepJSON {
    return {
      stepType: 'batchSetMark',
      chunks: this.chunks.map(markChunkToJSON),
    }
  }

  static override fromJSON(schema: Schema, json: unknown): BatchSetMarkStep {
    const chunks = (json as BatchSetMarkStepJSON).chunks
    return new BatchSetMarkStep(chunks.map((c) => markChunkFromJSON(schema, c)))
  }
}

Step.jsonID('batchSetMark', BatchSetMarkStep)

const emptyBatchSetMarkStep = new BatchSetMarkStep([])
