import { defineClipboardSerializer, type PlainExtension } from '@prosekit/core'

import { headingClipboardDOM } from '../heading.ts'
import { paragraphClipboardDOM } from '../paragraph.ts'
import type { NodeName } from '../node-names.ts'

/**
 * Serialize copied textblocks as semantic HTML (`<strong>`, `<em>`, real
 * `<h1>`..`<h6>`) with the source text preserved in `data-md`, and stamp every
 * top-level element with `data-meowdown` so the paste side can tell meowdown's
 * own clipboard HTML from foreign HTML even when no textblock is present
 * (e.g. a code-block-only copy).
 */
export function defineSemanticClipboardSerializer(): PlainExtension {
  return defineClipboardSerializer({
    serializeFragmentWrapper: (serializeFragment) => {
      return (...args) => {
        const fragment = serializeFragment(...args)
        for (const child of fragment.children) {
          child.setAttribute('data-meowdown', '')
        }
        return fragment
      }
    },
    nodesFromSchemaWrapper: (nodesFromSchema) => {
      return (...args) => {
        const nodes = nodesFromSchema(...args)
        return {
          ...nodes,
          ['paragraph' satisfies NodeName]: (node) => ({ dom: paragraphClipboardDOM(node) }),
          ['heading' satisfies NodeName]: (node) => ({ dom: headingClipboardDOM(node) }),
        }
      }
    },
  })
}
