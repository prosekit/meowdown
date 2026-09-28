import { describe, expect, it } from 'vitest'

import {
  parseMarkdownAst,
  resolveMarkdownAstPath,
  serializeMarkdownAst,
  walkMarkdownAst,
  type MarkdownListItem,
} from '../index.ts'

function task(value: string): MarkdownListItem {
  return {
    type: 'listItem',
    kind: 'task',
    marker: '+',
    checked: false,
    collapsed: false,
    children: [{ type: 'paragraph', value }],
  }
}

describe('AST paths', () => {
  it('walks all siblings and nested children in document order', () => {
    const document = parseMarkdownAst('# Heading\n\n+ [ ] parent\n  + [ ] child\n')
    const entries = [...walkMarkdownAst(document)]
    expect(entries.map(({ node, path }) => [node.type, path])).toEqual([
      ['document', []],
      ['heading', [0]],
      ['listItem', [1]],
      ['paragraph', [1, 0]],
      ['listItem', [1, 1]],
      ['paragraph', [1, 1, 0]],
    ])
    const child = resolveMarkdownAstPath(document, [1, 1])
    expect(child?.node).toBe(entries[4].node)
    expect(child?.parent).toBe(document.children[1])
    expect(child?.index).toBe(1)
    expect(resolveMarkdownAstPath(document, [])?.node).toBe(document)
  })

  it('traverses table rows and cells as addressable nodes', () => {
    const document = parseMarkdownAst('| **a** | b |\n| --- | --- |\n| c | d |\n')
    expect(resolveMarkdownAstPath(document, [0, 1, 0, 0])?.node).toEqual({
      type: 'paragraph',
      value: 'c',
    })
    for (const entry of walkMarkdownAst(document)) {
      expect(resolveMarkdownAstPath(document, entry.path)?.node).toBe(entry.node)
    }
  })

  it('rejects malformed, missing, sparse, and leaf-descending paths', () => {
    const document = parseMarkdownAst('text')
    expect(resolveMarkdownAstPath(document, [-1])).toBeUndefined()
    expect(resolveMarkdownAstPath(document, [0.5])).toBeUndefined()
    expect(resolveMarkdownAstPath(document, [NaN])).toBeUndefined()
    expect(resolveMarkdownAstPath(document, [Infinity])).toBeUndefined()
    expect(resolveMarkdownAstPath(document, [Number.MAX_SAFE_INTEGER + 1])).toBeUndefined()
    expect(resolveMarkdownAstPath(document, Array<number>(1))).toBeUndefined()
    expect(resolveMarkdownAstPath(document, [1])).toBeUndefined()
    expect(resolveMarkdownAstPath(document, [0, 0])).toBeUndefined()
  })

  it('copies the address instead of retaining a mutable caller array', () => {
    const path = [0]
    const entry = resolveMarkdownAstPath(parseMarkdownAst('text'), path)
    path[0] = 4
    expect(entry?.path).toEqual([0])
  })

  it('edits node references after earlier siblings move', () => {
    const document = parseMarkdownAst('+ [ ] first\n+ [ ] duplicate\n+ [ ] duplicate\n')
    const second = resolveMarkdownAstPath(document, [1])?.node
    const third = resolveMarkdownAstPath(document, [2])?.node
    if (second?.type !== 'listItem' || third?.type !== 'listItem') throw new Error('Expected tasks')
    document.children.shift()
    third.checked = true
    const paragraph = second.children[0]
    if (!paragraph || paragraph.type !== 'paragraph') throw new Error('Expected paragraph')
    paragraph.value = 'changed'
    expect(serializeMarkdownAst(document)).toBe('+ [ ] changed\n+ [x] duplicate\n')
    expect(resolveMarkdownAstPath(document, [1])?.node).toBe(third)
  })

  it('inserts an empty task and preserves it through whole-document serialization', () => {
    const document = parseMarkdownAst('# Tasks\n')
    document.children.push(task(''))
    const output = serializeMarkdownAst(document)
    expect(output).toBe('# Tasks\n\n+ [ ] \n')
    expect(serializeMarkdownAst(task(''))).toBe('+ [ ] \n')
  })

  it('deletes a task paragraph and promotes details without dropping their contents', () => {
    const document = parseMarkdownAst(
      '+ [ ] parent\n\n  details\n\n  > quote\n\n  ## Heading\n\n  + [ ] child\n',
    )
    const parent = document.children[0]
    if (parent.type !== 'listItem') throw new Error('Expected task')
    const child = parent.children.at(-1)
    if (child?.type !== 'listItem') throw new Error('Expected child task')
    document.children.splice(0, 1, ...parent.children.slice(1))
    child.checked = true
    const output = serializeMarkdownAst(document)
    expect(output).toBe('details\n\n> quote\n\n## Heading\n\n+ [x] child\n')
    expect(resolveMarkdownAstPath(document, [3])?.node).toBe(child)
  })

  it('converts a task into an expanded bullet while retaining details', () => {
    const document = parseMarkdownAst('+ [ ] parent\n\n  > quote\n')
    const item = document.children[0]
    if (item.type !== 'listItem') throw new Error('Expected task')
    item.kind = 'bullet'
    item.marker = '-'
    item.collapsed = false
    expect(serializeMarkdownAst(document)).toBe('- parent\n\n  > quote\n')
  })
})
