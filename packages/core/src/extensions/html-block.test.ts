import { describe, expect, it } from 'vitest'

import { getHTMLBlockKind } from './html-block.ts'

describe('getHTMLBlockKind', () => {
  it('classifies an element block', () => {
    expect(getHTMLBlockKind('<div>hello</div>')).toBe('element')
  })

  it('classifies a closing-tag block as element', () => {
    expect(getHTMLBlockKind('</div>')).toBe('element')
  })

  it('classifies a pre block as element', () => {
    expect(getHTMLBlockKind('<pre>code</pre>')).toBe('element')
  })

  it('classifies a custom tag block as element', () => {
    expect(getHTMLBlockKind('<my-widget prop="1"></my-widget>')).toBe('element')
  })

  it('classifies a comment', () => {
    expect(getHTMLBlockKind('<!-- note -->')).toBe('comment')
  })

  it('classifies a processing instruction', () => {
    expect(getHTMLBlockKind('<?php echo 1; ?>')).toBe('instruction')
  })

  it('classifies a declaration', () => {
    expect(getHTMLBlockKind('<!DOCTYPE html>')).toBe('declaration')
  })

  it('classifies a CDATA section', () => {
    expect(getHTMLBlockKind('<![CDATA[x < y]]>')).toBe('cdata')
  })

  it('classifies a script block as metadata', () => {
    expect(getHTMLBlockKind('<script>\nlet x = 1\n</script>')).toBe('metadata')
  })

  it('classifies a style block as metadata', () => {
    expect(getHTMLBlockKind('<style>\nbody { color: red }\n</style>')).toBe('metadata')
  })

  it('does not mistake a script-prefixed tag for metadata', () => {
    expect(getHTMLBlockKind('<scripture>text</scripture>')).toBe('element')
  })
})
