import {
  defineCommands,
  defineKeymap,
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
import type { Command, EditorState } from '@prosekit/pm/state'
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
  markerGap?: number
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

type ListMarkerGapExtension = Extension<{ Nodes: { list: { markerGap?: number } } }>

function isValidMarkerGap(value: number | null | undefined): value is 2 | 3 | 4 {
  return value === 2 || value === 3 || value === 4
}

function defineListMarkerGapAttr(): ListMarkerGapExtension {
  return defineNodeAttr<'list', 'markerGap', number>({
    type: 'list' satisfies NodeName,
    attr: 'markerGap',
    // The canonical single space between the marker and the content.
    default: 1,
    // A new item created by pressing Enter keeps the previous item's gap.
    splittable: true,
    // Persist only a non-canonical gap (2-4 spaces); 1 is the default the serializer
    // emits anyway, and the rest must survive an editor DOM re-parse. A gap of 5+ is
    // indented code, a different structure, so it never reaches here.
    toDOM: (value) => {
      return isValidMarkerGap(value) ? ['data-list-marker-gap', String(value)] : null
    },
    parseDOM: (node) => {
      const value = Number.parseInt(node.getAttribute('data-list-marker-gap') ?? '', 10)
      return isValidMarkerGap(value) ? value : 1
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

/** The attributes of the closest list node enclosing the selection, if any. */
function getListAttrsAtSelection(state: EditorState): MeowdownListAttrs | null {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name === ('list' satisfies NodeName)) {
      return node.attrs
    }
  }
  return null
}

/**
 * Cycle the block under the cursor through the square checkbox task states:
 * anything else -> unchecked square -> checked square -> bullet. (Mod-Enter)
 */
function rotateSquareTask(): Command {
  return (state, dispatch, view) => {
    const attrs = getListAttrsAtSelection(state)
    const isSquare = attrs?.kind === 'task' && attrs.marker !== '+'
    let next: MeowdownListAttrs
    if (isSquare && !attrs?.checked) {
      next = { kind: 'task', marker: attrs?.marker ?? null, checked: true }
    } else if (isSquare && attrs?.checked) {
      next = { kind: 'bullet', marker: null, checked: false }
    } else {
      next = { kind: 'task', marker: null, checked: false }
    }
    return wrapInList<MeowdownListAttrs>(next)(state, dispatch, view)
  }
}

/**
 * Cycle the block under the cursor through the circle checkbox task states:
 * anything else -> unchecked circle -> checked circle -> bullet. (Mod-Shift-Enter)
 */
function rotateCircleTask(): Command {
  return (state, dispatch, view) => {
    const attrs = getListAttrsAtSelection(state)
    const isCircle = attrs?.kind === 'task' && attrs.marker === '+'
    let next: MeowdownListAttrs
    if (isCircle && !attrs?.checked) {
      next = { kind: 'task', marker: '+', checked: true }
    } else if (isCircle && attrs?.checked) {
      next = { kind: 'bullet', marker: null, checked: false }
    } else {
      next = { kind: 'task', marker: '+', checked: false }
    }
    return wrapInList<MeowdownListAttrs>(next)(state, dispatch, view)
  }
}

function defineMeowdownListKeymap(): PlainExtension {
  return defineKeymap({
    'Mod-Enter': rotateSquareTask(),
    'Mod-Shift-Enter': rotateCircleTask(),
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
    defineMeowdownListKeymap(),
    defineListMarkerAttr(),
    defineListTaskMarkerAttr(),
    defineListMarkerGapAttr(),
    defineTaskCommands(),
  )
}
