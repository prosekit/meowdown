import { Mark, type Schema } from '@prosekit/pm/model'

/**
 * Contiguous range with a uniform inline-mark set.
 */
export type MarkChunk = readonly [from: number, to: number, marks: readonly Mark[]]

/**
 * JSON-serializable counterpart to `MarkChunk`.
 */
export type MarkChunkJSON = readonly [from: number, to: number, marks: unknown[]]

export function markChunkToJSON(chunk: MarkChunk): MarkChunkJSON {
  const [from, to, marks] = chunk
  return [from, to, marks.map((mark) => mark.toJSON() as unknown)]
}

export function markChunkFromJSON(schema: Schema, json: MarkChunkJSON): MarkChunk {
  const [from, to, marks] = json
  return [from, to, marks.map((markJSON) => Mark.fromJSON(schema, markJSON))]
}
