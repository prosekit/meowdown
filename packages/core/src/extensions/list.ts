import {
  defineCommands,
  defineNodeAttr,
  union,
  type Extension,
  type PlainExtension,
} from '@prosekit/core'
import { defineInputRule } from '@prosekit/extensions/input-rule'
import {
  defineListCommands,
  defineListDropIndicator,
  defineListKeymap,
  defineListPlugins,
  defineListSerializer,
  defineListSpec,
  wrapInList,
  type ListAttrs,
} from '@prosekit/extensions/list'
import type { Command } from '@prosekit/pm/state'
import { wrappingListInputRule } from 'prosemirror-flat-list'

import type { NodeName } from './node-names.ts'

/**
 * The marker for a list item.
 *
 * For ordered list items, the marker is `.` or `)`.
 * For bullet and task list items, the marker is `-`, `*`, or `+`.
 * For a task list item, the marker `+` renders a circle checkbox, while the other markers render a square checkbox.
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
    toDOM: (value) => {
      if (value === ')' || value === '*' || value === '+') {
        return ['data-list-marker', value]
      } else {
        return null
      }
    },
    parseDOM: (node) => {
      const value = node.getAttribute('data-list-marker')
      if (value === ')' || value === '*' || value === '+') {
        return value
      } else {
        return null
      }
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
    toDOM: (value) => {
      return value === 'X' ? ['data-list-task-marker', value] : null
    },
    parseDOM: (node) => {
      return node.getAttribute('data-list-task-marker') === 'X' ? 'X' : null
    },
  })
}

const listInputRules = [
  wrappingListInputRule<MeowdownListAttrs>(/^\s?([*-])\s$/, {
    kind: 'bullet',
    collapsed: false,
  }),
  wrappingListInputRule<MeowdownListAttrs>(/^\s?(\d+)\.\s$/, ({ match }) => {
    const text = match[1]
    const num = text ? parseInt(text, 10) : undefined
    return {
      kind: 'ordered',
      collapsed: false,
      order: num && num >= 2 && Number.isSafeInteger(num) ? num : null,
    }
  }),
  wrappingListInputRule<MeowdownListAttrs>(/^\s?\[([\sXx]?)]\s$/, ({ match }) => {
    return {
      kind: 'task',
      checked: ['x', 'X'].includes(match[1]),
      collapsed: false,
    }
  }),
  /**
   * `+ ` at the start of a block wraps it into an unchecked circle checkbox task.
   * The square checkbox task keeps ProseKit's default `[ ] ` / `[x] ` input rule.
   */
  wrappingListInputRule<MeowdownListAttrs>(/^\s?\+\s$/, {
    kind: 'task',
    marker: '+',
    checked: false,
    collapsed: false,
  }),
]

function defineMeowdownListInputRules(): PlainExtension {
  return union(listInputRules.map(defineInputRule))
}

/** Circle checkbox task: a `task` list item with a `+` marker. */
function wrapInCircleTask(): Command {
  return wrapInList<MeowdownListAttrs>({ kind: 'task', marker: '+' })
}

/** Square checkbox task: a `task` list item with the canonical `-` marker. */
function wrapInSquareTask(): Command {
  return wrapInList<MeowdownListAttrs>({ kind: 'task', marker: null })
}

function defineTaskCommands() {
  return defineCommands({
    wrapInCircleTask,
    wrapInSquareTask,
  })
}

export function defineMeowdownList() {
  return union(
    defineListSpec(),
    defineListPlugins(),
    defineListKeymap(),
    defineListCommands(),
    defineListSerializer(),
    defineListDropIndicator(),

    defineMeowdownListInputRules(),
    defineListMarkerAttr(),
    defineListTaskMarkerAttr(),
    defineTaskCommands(),
  )
}
