import { defineNodeAttr, union, type Extension } from '@prosekit/core'
import { defineList as defineFlatList } from '@prosekit/extensions/list'

import type { NodeName } from './node-names.ts'

/**
 * The delimiter after an ordered list number: a period (`1.`) or a closing
 * paren (`1)`). Only ordered items use it; bullet and task items keep the
 * default `.`.
 */
export type ListMarker = '.' | ')'

// `marker` has a default, so it must stay optional in the node builders.
type ListMarkerExtension = Extension<{ Nodes: { list: { marker?: ListMarker } } }>

function defineListMarkerAttr(): ListMarkerExtension {
  return defineNodeAttr<'list', 'marker', ListMarker>({
    type: 'list' satisfies NodeName,
    attr: 'marker',
    default: '.',
    // A new item created by pressing Enter keeps the previous item's delimiter.
    splittable: true,
    toDOM: (value) => (value === ')' ? ['data-list-marker', ')'] : null),
    parseDOM: (node) => (node.getAttribute('data-list-marker') === ')' ? ')' : '.'),
  })
}

/**
 * The flat-list extension plus a `marker` attribute so an ordered list keeps
 * its source delimiter (`1.` vs `1)`) through a markdown round-trip.
 */
export function defineList() {
  return union(defineFlatList(), defineListMarkerAttr())
}
