import { Mark, type EditorNode, type Schema } from '@prosekit/pm/model'
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

    let tr: Transform | undefined
    for (const [from, to, expected] of this.chunks) {
      if (from >= to) continue

      const safeFrom = Math.max(0, Math.min(from, docSize))
      const safeTo = Math.max(safeFrom, Math.min(to, docSize))
      if (safeFrom >= safeTo) continue

      // Rank-sorted like a node's own mark set; equal-rank marks (nested
      // mdPack) keep the parser's outer-first emit order, so rewriting a node
      // whose set merely differs in order keeps same-type marks canonical.
      const expectedSet = Mark.setFrom(expected)

      doc.nodesBetween(safeFrom, safeTo, (node, pos) => {
        if (!node.isText) return true
        const nodeFrom = Math.max(safeFrom, pos)
        const nodeTo = Math.min(safeTo, pos + node.nodeSize)
        if (nodeFrom >= nodeTo) return false
        const current = node.marks
        if (marksEqual(current, expectedSet)) return false

        tr ??= new Transform(doc)
        for (const mark of current) {
          tr.removeMark(nodeFrom, nodeTo, mark)
        }
        for (const mark of expectedSet) {
          tr.addMark(nodeFrom, nodeTo, mark)
        }
        return false
      })
    }

    return StepResult.ok(tr ? tr.doc : doc)
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
