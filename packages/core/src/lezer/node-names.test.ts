import { describe, expect, it } from 'vitest'

import { LEZER_NODE_NAMES } from './node-names.ts'
import { gfmParser } from './parser.ts'

describe('LEZER_NODE_NAMES', () => {
  it('contains all node names from gfmParser', () => {
    const nodes: string[] = []
    for (const node of gfmParser.nodeSet.types) {
      if (node.name) {
        nodes.push(node.name)
      }
    }
    expect(nodes.sort()).toEqual([...LEZER_NODE_NAMES].sort())
  })
})
