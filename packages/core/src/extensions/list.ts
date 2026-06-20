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

/**
 * The character inside a checked task's checkbox.
 *
 * GFM marks a box checked with either `x` or `X`. Defaults to null, which the
 * serializer emits as the canonical lowercase `x`.
 */
export type TaskMarker = 'x' | 'X' | null

export interface MeowdownListAttrs extends ListAttrs {
  marker?: ListMarker
  taskMarker?: TaskMarker
}

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

type ListTaskMarkerExtension = Extension<{ Nodes: { list: { taskMarker?: TaskMarker } } }>

function defineListTaskMarkerAttr(): ListTaskMarkerExtension {
  return defineNodeAttr<'list', 'taskMarker', TaskMarker>({
    type: 'list' satisfies NodeName,
    attr: 'taskMarker',
    default: null,
    // A new item created by pressing Enter keeps the previous item's casing.
    splittable: true,
    // Persist only the non-canonical uppercase `X`; lowercase `x` is the
    // default the serializer emits anyway, and it must survive a DOM re-parse.
    toDOM: (value) => (value === 'X' ? ['data-list-task-marker', value] : null),
    parseDOM: (node) => (node.getAttribute('data-list-task-marker') === 'X' ? 'X' : null),
  })
}

export type MeowdownListExtension = Union<
  [ListExtensionBase, ListMarkerExtension, ListTaskMarkerExtension]
>

export function defineMeowdownList(): MeowdownListExtension {
  return union(defineListBase(), defineListMarkerAttr(), defineListTaskMarkerAttr())
}
