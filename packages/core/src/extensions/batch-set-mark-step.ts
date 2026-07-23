import { Fragment, Mark, type EditorNode, type Schema } from '@prosekit/pm/model'
import type { Mappable } from '@prosekit/pm/transform'
import { ReplaceStep, Step, StepResult } from '@prosekit/pm/transform'

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
    const docSize = doc.content.size
    const sorted = [...this.chunks]
      .filter(([from, to]) => from < to && from < docSize)
      .sort((left, right) => left[0] - right[0])
    if (sorted.length === 0) return StepResult.ok(doc)

    // Rank-sorted like a node's own mark set; equal-rank marks (nested
    // mdPack) keep the parser's outer-first emit order, so rewriting a node
    // whose set merely differs in order keeps same-type marks canonical.
    const expectedSets = sorted.map(([, , marks]) => Mark.setFrom(marks))

    const first = Math.max(0, sorted[0][0])
    let last = 0
    for (const [, to] of sorted) {
      if (to > last) last = to
    }
    last = Math.min(last, docSize)
    if (first >= last) return StepResult.ok(doc)

    // One ordered pass over the document with a moving chunk pointer.
    // Untouched siblings are reused as-is, so the cost is proportional to
    // the spanned blocks, never chunks x blocks.
    let chunkIndex = 0

    const rebuildText = (node: EditorNode, nodeFrom: number): EditorNode[] | undefined => {
      const nodeTo = nodeFrom + node.nodeSize
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
      if (!changed) return undefined
      if (cursor < nodeTo) pieces.push({ from: cursor, to: nodeTo, marks: undefined })
      return pieces.map((piece) => {
        const cut = node.cut(piece.from - nodeFrom, piece.to - nodeFrom)
        return piece.marks === undefined ? cut : cut.mark(piece.marks)
      })
    }

    const rebuildContent = (node: EditorNode, contentFrom: number): Fragment | undefined => {
      let rebuilt: EditorNode[] | undefined
      let childFrom = contentFrom
      for (let index = 0; index < node.childCount; index++) {
        const child = node.child(index)
        const childTo = childFrom + child.nodeSize
        let replacement: EditorNode | EditorNode[] = child
        if (childTo > first && childFrom < last) {
          if (child.isText) {
            replacement = rebuildText(child, childFrom) ?? child
          } else if (child.childCount > 0) {
            const content = rebuildContent(child, childFrom + 1)
            if (content !== undefined) replacement = child.copy(content)
          }
        }
        if (replacement !== child && rebuilt === undefined) {
          rebuilt = []
          for (let seen = 0; seen < index; seen++) rebuilt.push(node.child(seen))
        }
        if (rebuilt !== undefined) {
          if (Array.isArray(replacement)) {
            rebuilt.push(...replacement)
          } else {
            rebuilt.push(replacement)
          }
        }
        childFrom = childTo
      }
      return rebuilt === undefined ? undefined : Fragment.fromArray(rebuilt)
    }

    const content = rebuildContent(doc, 0)
    return StepResult.ok(content === undefined ? doc : doc.copy(content))
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
