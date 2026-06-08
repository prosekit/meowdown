import { Schema } from '@prosekit/pm/model'
import { ReplaceStep, Step } from '@prosekit/pm/transform'
import { describe, expect, it } from 'vitest'

import { marksAt } from '../testing/marks-at.ts'

import { BatchSetMarkStep } from './batch-set-mark-step.ts'
import type { MarkChunk } from './mark-chunk.ts'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    text: { group: 'inline' },
  },
  marks: {
    mark1: {},
    mark2: {},
    mark3: { attrs: { url: { default: '' } } },
  },
})

const m1 = () => schema.marks.mark1.create()
const m2 = () => schema.marks.mark2.create()
const m3 = (url: string) => schema.marks.mark3.create({ url })

/** Build a paragraph doc from raw text (no marks). */
function makeDoc(text: string) {
  return schema.node('doc', null, [schema.node('paragraph', null, [schema.text(text)])])
}

describe('BatchSetMarkStep', () => {
  it('applies a single chunk', () => {
    const doc = makeDoc('hello')
    const chunks: MarkChunk[] = [[1, 6, [m1()]]]
    const step = new BatchSetMarkStep(chunks)
    const result = step.apply(doc)
    expect(result.failed).toBeNull()
    expect(marksAt(result.doc!, 2)).toEqual(['mark1'])
    expect(marksAt(result.doc!, 5)).toEqual(['mark1'])
  })

  it('applies multiple disjoint chunks', () => {
    const doc = makeDoc('one two three')
    const chunks: MarkChunk[] = [
      [1, 4, [m1()]], // "one"
      [9, 14, [m2()]], // "three"
    ]
    const result = new BatchSetMarkStep(chunks).apply(doc)
    expect(result.failed).toBeNull()
    expect(marksAt(result.doc!, 2)).toEqual(['mark1'])
    expect(marksAt(result.doc!, 11)).toEqual(['mark2'])
    expect(marksAt(result.doc!, 6)).toEqual([])
  })

  it('applies overlapping marks at distinct ranges', () => {
    const doc = makeDoc('aaaa')
    const chunks: MarkChunk[] = [
      [1, 3, [m1(), m2()]],
      [3, 5, [m1()]],
    ]
    const result = new BatchSetMarkStep(chunks).apply(doc)
    expect(result.failed).toBeNull()
    expect(marksAt(result.doc!, 2)).toEqual(['mark1', 'mark2'])
    expect(marksAt(result.doc!, 4)).toEqual(['mark1'])
  })

  it('removes existing managed marks not in the new set', () => {
    const text = schema.text('hi', [m1()])
    const doc = schema.node('doc', null, [schema.node('paragraph', null, [text])])
    expect(marksAt(doc, 2)).toEqual(['mark1'])
    // Apply a chunk with NO marks - should strip the managed mark1.
    const result = new BatchSetMarkStep([[1, 3, []]]).apply(doc)
    expect(marksAt(result.doc!, 2)).toEqual([])
  })

  it('is a no-op for empty chunks', () => {
    const doc = makeDoc('hello')
    const result = new BatchSetMarkStep([]).apply(doc)
    expect(result.failed).toBeNull()
    expect(result.doc).toBe(doc)
  })

  it('returns the same doc when the marks already match', () => {
    const text = schema.text('hi', [m1()])
    const doc = schema.node('doc', null, [schema.node('paragraph', null, [text])])
    const result = new BatchSetMarkStep([[1, 3, [m1()]]]).apply(doc)
    expect(result.failed).toBeNull()
    expect(result.doc!.toJSON()).toEqual(doc.toJSON())
  })

  it('invert + apply round-trips back to the original doc', () => {
    const doc = makeDoc('hello world')
    const step = new BatchSetMarkStep([
      [1, 6, [m1()]],
      [7, 12, [m2()]],
    ])
    const applied = step.apply(doc).doc!
    const inverse = step.invert(doc)
    const restored = inverse.apply(applied).doc!
    expect(restored.toJSON()).toEqual(doc.toJSON())
  })

  it('invert returns a ReplaceStep', () => {
    const doc = makeDoc('hello')
    const step = new BatchSetMarkStep([[1, 6, [m1()]]])
    expect(step.invert(doc)).toBeInstanceOf(ReplaceStep)
  })

  it('map always returns null (plugin re-derives on next dispatch)', () => {
    const step = new BatchSetMarkStep([[1, 5, [m1()]]])
    expect(step.map({} as never)).toBeNull()
  })

  it('merge always returns null', () => {
    const step = new BatchSetMarkStep([[1, 5, [m1()]]])
    const other = new BatchSetMarkStep([[5, 9, [m1()]]])
    expect(step.merge(other)).toBeNull()
  })

  it('toJSON / fromJSON round-trip', () => {
    const step = new BatchSetMarkStep([
      [1, 4, [m1()]],
      [5, 9, [m3('http://x')]],
    ])
    const json = step.toJSON() as { stepType: string }
    expect(json.stepType).toBe('batchSetMark')
    const restored = BatchSetMarkStep.fromJSON(schema, json)
    expect(restored.chunks.length).toBe(2)
    expect(restored.chunks[0][0]).toBe(1)
    expect(restored.chunks[0][1]).toBe(4)
    expect(restored.chunks[0][2][0].type.name).toBe('mark1')
    expect(restored.chunks[1][2][0].type.name).toBe('mark3')
    expect(restored.chunks[1][2][0].attrs.url).toBe('http://x')
  })

  it('is registered with Step.jsonID', () => {
    const step = new BatchSetMarkStep([[1, 4, [m1()]]])
    const json = step.toJSON() as { stepType: string }
    const reborn = Step.fromJSON(schema, json)
    expect(reborn).toBeInstanceOf(BatchSetMarkStep)
  })
})
