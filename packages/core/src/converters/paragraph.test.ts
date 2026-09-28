import { Schema } from '@prosekit/pm/model'
import { describe, expect, it } from 'vitest'

import { getNodeBuilders, getNodeBuildersForSchema } from '../extensions/schema.ts'

import { markdownToDoc } from './md-to-pm.ts'
import { docToParagraphMarkdown, paragraphMarkdownToDoc } from './paragraph.ts'

describe('paragraph content', () => {
  it('builds the paragraph with the supplied schema', () => {
    const shared = getNodeBuilders().doc().type.schema
    const schema = new Schema({ nodes: shared.spec.nodes, marks: shared.spec.marks })
    const doc = paragraphMarkdownToDoc('**raw**', getNodeBuildersForSchema(schema))
    expect(doc.type.schema).toBe(schema)
    expect(doc.child(0).type.schema).toBe(schema)
    expect(docToParagraphMarkdown(doc)).toBe('**raw**')
  })

  it('keeps heading-looking content and marks inside one paragraph', () => {
    const doc = paragraphMarkdownToDoc('# literal\n**strong**')
    expect(doc.childCount).toBe(1)
    expect(doc.child(0).type.name).toBe('paragraph')
    expect(docToParagraphMarkdown(doc)).toBe('# literal\n**strong**')
  })

  it('flattens pasted blocks into paragraph content', () => {
    expect(docToParagraphMarkdown(markdownToDoc('# heading\n\n> **quote**\n\n- item'))).toBe(
      'heading\n**quote**\nitem',
    )
  })
})
