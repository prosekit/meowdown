import { defineClipboardSerializer, type PlainExtension } from '@prosekit/core'
import { DOMSerializer } from '@prosekit/pm/model'
import type { DOMOutputSpec, ProseMirrorNode, Schema } from '@prosekit/pm/model'

import { headingClipboardDOM } from '../heading.ts'
import type { NodeName } from '../node-names.ts'
import { paragraphClipboardDOM } from '../paragraph.ts'

type NodeSerializers = Record<string, (node: ProseMirrorNode) => DOMOutputSpec>

function withSemanticTextblocks(nodes: NodeSerializers): NodeSerializers {
  return {
    ...nodes,
    ['paragraph' satisfies NodeName]: (node) => ({ dom: paragraphClipboardDOM(node) }),
    ['heading' satisfies NodeName]: (node) => ({ dom: headingClipboardDOM(node) }),
  }
}

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
      return (...args) => withSemanticTextblocks(nodesFromSchema(...args))
    },
  })
}

const semanticSerializerCache = new WeakMap<Schema, DOMSerializer>()

/**
 * The semantic serializer as a plain `DOMSerializer`, for callers outside the
 * clipboard facet (`defineHTMLPaste` re-serializes converted foreign HTML with
 * it, so the intermediate HTML also carries `data-md`).
 */
export function getSemanticDOMSerializer(schema: Schema): DOMSerializer {
  let serializer = semanticSerializerCache.get(schema)
  if (serializer == null) {
    serializer = new DOMSerializer(
      withSemanticTextblocks(DOMSerializer.nodesFromSchema(schema)),
      DOMSerializer.marksFromSchema(schema),
    )
    semanticSerializerCache.set(schema, serializer)
  }
  return serializer
}
