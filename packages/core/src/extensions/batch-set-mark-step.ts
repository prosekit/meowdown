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

      transform ??= new Transform(doc)
      for (const mark of node.marks) transform.removeMark(nodeFrom, nodeTo, mark)
      for (const mark of expected) transform.addMark(nodeFrom, nodeTo, mark)
      return false
    })
  }

  return StepResult.ok(transform?.doc ?? doc)
}

function applySequentialChunks(doc: EditorNode, chunks: readonly MarkChunk[]): StepResult {
  const docSize = doc.content.size
  let chunkIndex = 0

  function rewriteText(node: EditorNode, position: number): readonly EditorNode[] {
    const nodeEnd = position + node.nodeSize
    while (chunkIndex < chunks.length && chunks[chunkIndex][1] <= position) {
      chunkIndex++
    }

    let index = chunkIndex
    let offset = 0
    let changed = false
    const pieces: EditorNode[] = []

    while (index < chunks.length) {
      const [from, to, unsortedMarks] = chunks[index]
      const safeFrom = Math.max(0, Math.min(from, docSize))
      const safeTo = Math.max(safeFrom, Math.min(to, docSize))
      if (safeFrom >= nodeEnd) break
      if (safeTo <= position || safeFrom >= safeTo) {
        index++
        continue
      }

      const localFrom = Math.max(offset, safeFrom - position)
      const localTo = Math.min(node.nodeSize, safeTo - position)
      if (localFrom > offset) pieces.push(node.cut(offset, localFrom))

      const expected = Mark.setFrom(unsortedMarks)
      const piece = node.cut(localFrom, localTo)
      if (marksEqual(piece.marks, expected)) {
        pieces.push(piece)
      } else {
        pieces.push(piece.mark(expected))
        changed = true
      }

      offset = localTo
      if (safeTo <= nodeEnd) index++
      else break
    }

    if (!changed) return [node]
    if (offset < node.nodeSize) pieces.push(node.cut(offset))
    chunkIndex = index
    return pieces
  }

  function rewriteNode(node: EditorNode, contentStart: number): EditorNode {
    let changed = false
    const children: EditorNode[] = []

    node.forEach((child, offset) => {
      const position = contentStart + offset
      if (child.isText) {
        const rewritten = rewriteText(child, position)
        if (rewritten.length !== 1 || rewritten[0] !== child) changed = true
        children.push(...rewritten)
      } else {
        const rewritten = rewriteNode(child, position + 1)
        if (rewritten !== child) changed = true
        children.push(rewritten)
      }
    })

    return changed ? node.copy(Fragment.fromArray(children)) : node
  }

  return StepResult.ok(rewriteNode(doc, 0))
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
