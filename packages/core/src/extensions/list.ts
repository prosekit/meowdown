import {
  defineCommands,
  defineKeymap,
  defineNodeAttr,
  definePlugin,
  isNodeSelection,
  union,
  type Extension,
  type PlainExtension,
} from '@prosekit/core'
import { defineInputRule } from '@prosekit/extensions/input-rule'
import {
  defineListCommands,
  defineListDropIndicator,
  defineListKeymap,
  defineListSerializer,
  defineListSpec,
  toggleList,
  wrapInList,
  type ListAttrs,
} from '@prosekit/extensions/list'
import { chainCommands } from '@prosekit/pm/commands'
import type { ProseMirrorNode } from '@prosekit/pm/model'
import { Plugin, Selection } from '@prosekit/pm/state'
import type { Command, EditorState } from '@prosekit/pm/state'
import { canSplit } from '@prosekit/pm/transform'
import {
  createListRenderingPlugin,
  createSafariInputMethodWorkaroundPlugin,
  createToggleCollapsedCommand,
  handleListMarkerMouseDown,
  isListNode,
  protectCollapsed,
  unwrapListSlice,
  wrappingListInputRule,
  type ListClickHandler,
} from 'prosemirror-flat-list'

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

/**
 * A bullet is collapsible when it has descendants to hide: the first child is the
 * item's own content and the rest (a nested list or extra blocks) collapse away.
 * Only bullets fold in v1; their fold state round-trips through the `+` marker.
 */
function isCollapsibleBullet(node: ProseMirrorNode): boolean {
  return (
    node.type.name === ('list' satisfies NodeName) &&
    node.attrs.kind === 'bullet' &&
    node.childCount >= 2 &&
    node.firstChild?.type !== node.type
  )
}

/**
 * Clicking a list marker toggles the checkbox on a task and the fold on a
 * collapsible bullet; any other click is a no-op.
 */
const onListClick: ListClickHandler = (node) => {
  const attrs = node.attrs as MeowdownListAttrs
  if (attrs.kind === 'task') {
    return { ...attrs, checked: !attrs.checked }
  }
  if (isCollapsibleBullet(node)) {
    return { ...attrs, collapsed: !attrs.collapsed }
  }
  return attrs
}

/**
 * The list plugins, mirroring ProseKit's `defineListPlugins` but with a marker
 * mousedown handler that also folds bullets. ProseKit's default handler swallows
 * every marker click, so it must be replaced rather than layered on top.
 */
function defineMeowdownListPlugins(): PlainExtension {
  return definePlugin(() => [
    new Plugin({
      props: {
        handleDOMEvents: {
          mousedown: (view, event) => handleListMarkerMouseDown({ view, event, onListClick }),
        },
      },
    }),
    createListRenderingPlugin(),
    new Plugin({ props: { transformCopied: unwrapListSlice } }),
    createSafariInputMethodWorkaroundPlugin(),
  ])
}

function defineCollapseCommands() {
  return defineCommands({
    toggleListCollapsed: () => createToggleCollapsedCommand({ isToggleable: isCollapsibleBullet }),
  })
}

/**
 * The attrs Enter carries over to the list item it creates: `kind` plus the
 * attrs declared `splittable` above. The per-item state (`checked`,
 * `collapsed`, `order`) resets, matching prosemirror-flat-list.
 */
function deriveSplittableListAttrs(attrs: MeowdownListAttrs): MeowdownListAttrs {
  return {
    kind: attrs.kind,
    marker: attrs.marker ?? null,
    taskMarker: attrs.taskMarker ?? null,
    markerGap: attrs.markerGap ?? 1,
  }
}

/**
 * Split the current list item, keeping the splittable attrs on the new item.
 *
 * prosemirror-flat-list's own Enter command derives the new item's attrs from
 * `kind` alone, so pressing Enter at the end of a circle checkbox task
 * (`+ [ ]`) would continue with a square one, and a `*` bullet with a `-`
 * bullet. This mirrors its `splitListCommand`, covering only the paths that
 * create a new item; the rest (an empty item dedents, a later block of an
 * item splits in place) return false and fall through to the stock binding.
 */
const splitListKeepingMarker: Command = (state, dispatch) => {
  if (isNodeSelection(state.selection)) {
    return false
  }
  const { $from, $to } = state.selection
  if (!$from.sameParent($to) || $from.depth < 2) {
    return false
  }
  const listDepth = $from.depth - 1
  const listNode = $from.node(listDepth)
  if (!isListNode(listNode)) {
    return false
  }
  const attrs = listNode.attrs as MeowdownListAttrs
  const newAttrs = deriveSplittableListAttrs(attrs)
  if (newAttrs.marker === null && newAttrs.taskMarker === null && newAttrs.markerGap === 1) {
    // Nothing beyond `kind` to keep: the stock command's result is identical.
    return false
  }
  if ($from.index(listDepth) !== 0 || $from.parent.content.size === 0) {
    // Enter creates no new item here: an empty first block dedents and a
    // later block splits in place. Nothing to keep either way.
    return false
  }

  const tr = state.tr
  tr.delete(tr.selection.from, tr.selection.to)
  const $cut = tr.selection.$to
  const atStart = $cut.parentOffset === 0
  const atEnd = $cut.parentOffset === $cut.parent.content.size

  if (atStart || (atEnd && attrs.collapsed)) {
    // The new item is empty: above the caret (`atStart`) or, for a collapsed
    // item, below its hidden children. The original item stays untouched.
    const newItem = listNode.type.createAndFill(newAttrs)
    if (!newItem) {
      return false
    }
    if (dispatch) {
      const pos = atStart ? tr.selection.$from.before(-1) : tr.selection.$from.after(-1)
      tr.insert(pos, newItem)
      if (!atStart) {
        tr.setSelection(Selection.near(tr.doc.resolve(pos)))
      }
      dispatch(tr.scrollIntoView())
    }
    return true
  }

  const nextType = atEnd ? listNode.contentMatchAt(0).defaultType : undefined
  const typesAfter = [
    { type: listNode.type, attrs: newAttrs },
    nextType ? { type: nextType } : null,
  ]
  if (!canSplit(tr.doc, tr.selection.from, 2, typesAfter)) {
    return false
  }
  dispatch?.(tr.split(tr.selection.from, 2, typesAfter).scrollIntoView())
  return true
}

function defineMeowdownListKeymap(): PlainExtension {
  return defineKeymap({
    // Runs before prosemirror-flat-list's Enter binding (keymaps registered
    // later win), which would drop the splittable attrs from the new item.
    Enter: chainCommands(protectCollapsed, splitListKeepingMarker),
    'Mod-Enter': rotateSquareTask(),
    'Mod-Shift-Enter': rotateCircleTask(),
    'Mod-.': createToggleCollapsedCommand({ isToggleable: isCollapsibleBullet }),
    // Google-Docs muscle memory: same kind unwraps, a different kind converts
    // in place, and a non-list block wraps.
    'Mod-Shift-7': toggleList<MeowdownListAttrs>({ kind: 'ordered', collapsed: false }),
    'Mod-Shift-8': toggleList<MeowdownListAttrs>({ kind: 'bullet', collapsed: false }),
    'Mod-Shift-9': toggleList<MeowdownListAttrs>({
      kind: 'task',
      checked: false,
      collapsed: false,
    }),
  })
}

export function defineMeowdownList() {
  return union(
    defineListSpec(),
    defineMeowdownListPlugins(),
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
    defineCollapseCommands(),
  )
}
