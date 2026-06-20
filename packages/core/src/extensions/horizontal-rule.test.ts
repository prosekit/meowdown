import { createEditor } from '@prosekit/core'
import { DOMParser, DOMSerializer } from '@prosekit/pm/model'
import { describe, expect, it } from 'vitest'

import { defineEditorExtension } from './extension.ts'

function setupEditor() {
  const editor = createEditor({ extension: defineEditorExtension() })
  return { editor, schema: editor.schema, n: editor.nodes }
}

describe('horizontal rule marker', () => {
  it('keeps a non-canonical marker through a DOM round-trip', () => {
    const { schema, n } = setupEditor()
    const doc = n.doc(n.horizontalRule({ marker: '***' }))

    const dom = DOMSerializer.fromSchema(schema).serializeFragment(doc.content)
    const container = document.createElement('div')
    container.appendChild(dom)

    const parsed = DOMParser.fromSchema(schema).parse(container)
    expect(parsed.child(0).attrs.marker).toBe('***')
  })

  it('parses a bare foreign hr as a default rule', () => {
    const { schema } = setupEditor()
    const container = document.createElement('div')
    container.innerHTML = '<hr>'

    const parsed = DOMParser.fromSchema(schema).parse(container)
    expect(parsed.child(0).type.name).toBe('horizontalRule')
    expect(parsed.child(0).attrs.marker).toBe(null)
  })
})
