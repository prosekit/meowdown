import { DOMParser, DOMSerializer } from '@prosekit/pm/model'
import { describe, expect, it } from 'vitest'

import { setupFixture } from '../testing/index.ts'

describe('codeBlock attrs', () => {
  it('keeps `fenceStyle` and `fenceLength` through a DOM round-trip', () => {
    using fixture = setupFixture()
    const { schema, n } = fixture
    const doc = n.doc(n.codeBlock({ language: 'js', fenceStyle: 'tilde', fenceLength: 4 }, 'code'))

    const dom = DOMSerializer.fromSchema(schema).serializeFragment(doc.content)
    const container = document.createElement('div')
    container.appendChild(dom)

    const parsed = DOMParser.fromSchema(schema).parse(container)
    expect(parsed.child(0).attrs).toMatchObject({
      language: 'js',
      fenceStyle: 'tilde',
      fenceLength: 4,
    })
  })
})
