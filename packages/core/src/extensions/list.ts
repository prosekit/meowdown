import { defineNodeAttr, union, type Extension, type Union } from '@prosekit/core'
import {
  defineList as defineListBase,
  type ListAttrs,
  type ListExtension as ListExtensionBase,
} from '@prosekit/extensions/list'

import type { NodeName } from './node-names.ts'

/**
 * The marker for an list item.
 *
 * For ordered list items, the marker is either `.` or `)`.
 *
 * Default to null if unknown.
 */
export type ListMarker = '.' | ')' | null

export interface MeowdownListAttrs extends ListAttrs {
  marker?: ListMarker
}

// `marker` has a default, so it must stay optional in the node builders.
type ListMarkerExtension = Extension<{ Nodes: { list: { marker?: ListMarker } } }>

function defineListMarkerAttr(): ListMarkerExtension {
  return defineNodeAttr<'list', 'marker', ListMarker>({
    type: 'list' satisfies NodeName,
    attr: 'marker',
    default: null,
    // A new item created by pressing Enter keeps the previous item's delimiter.
    splittable: true,
    toDOM: (value) => (value === ')' ? ['data-list-marker', ')'] : null),
    parseDOM: (node) => (node.getAttribute('data-list-marker') === ')' ? ')' : '.'),
  })
}

export type MeowdownListExtension = Union<[ListExtensionBase, ListMarkerExtension]>

// REVIEW: TODO: remove this comment below
/**
 * The flat-list extension plus a `marker` attribute so an ordered list keeps
 * its source delimiter (`1.` vs `1)`) through a markdown round-trip.
 */
export function defineMeowdownList(): MeowdownListExtension {
  return union(defineListBase(), defineListMarkerAttr())
}
