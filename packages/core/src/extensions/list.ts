import { defineNodeAttr, union, type Extension, type Union } from '@prosekit/core'
import {
  defineList as defineListBase,
  type ListAttrs,
  type ListExtension as ListExtensionBase,
} from '@prosekit/extensions/list'

import type { NodeName } from './node-names.ts'

/**
 * The marker for a list item.
 *
 * For ordered list items, the marker is `.` or `)`.
 * For bullet and task list items, the marker is `-`, `*`, or `+`.
 *
 * Defaults to null if unknown.
 */
export type ListMarker = '.' | ')' | '-' | '*' | '+' | null

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
    // Persist only the non-canonical markers (`.` and `-` are the defaults the
    // serializer emits anyway); the rest must survive an editor DOM re-parse.
    toDOM: (value) =>
      value === ')' || value === '*' || value === '+' ? ['data-list-marker', value] : null,
    parseDOM: (node) => {
      const value = node.getAttribute('data-list-marker')
      return value === ')' || value === '*' || value === '+' ? value : null
    },
  })
}

export type MeowdownListExtension = Union<[ListExtensionBase, ListMarkerExtension]>

export function defineMeowdownList(): MeowdownListExtension {
  return union(defineListBase(), defineListMarkerAttr())
}
