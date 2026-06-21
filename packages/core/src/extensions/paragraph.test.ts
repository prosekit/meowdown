import { createEditor } from '@prosekit/core'
import { DOMParser, DOMSerializer } from '@prosekit/pm/model'
import { describe, expect, it } from 'vitest'

import { defineEditorExtension } from './extension.ts'

function setupEditor() {
  const editor = createEditor({ extension: defineEditorExtension() })
  return { editor, schema: editor.schema, n: editor.nodes }
}

describe('paragraph', () => {
  it('declares whitespace: pre', () => {
    const { schema } = setupEditor()
    expect(schema.nodes.paragraph.spec.whitespace).toBe('pre')
  })

  it('keeps a soft line break through a DOM round-trip', () => {
    const { schema, n } = setupEditor()
    const doc = n.doc(n.list({ kind: 'bullet' }, n.paragraph('line one\nline two')))

    const dom = DOMSerializer.fromSchema(schema).serializeFragment(doc.content)
    const container = document.createElement('div')
    container.appendChild(dom)

    const parsed = DOMParser.fromSchema(schema).parse(container)
    expect(parsed.child(0).child(0).textContent).toBe('line one\nline two')
  })
})
