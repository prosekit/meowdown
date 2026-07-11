import { isElementLike } from '@ocavue/utils'
import {
  defineClipboardSerializer,
  defineCommands,
  defineKeymap,
  defineNodeAttr,
  definePlugin,
  union,
  type Extension,
  type PlainExtension,
} from '@prosekit/core'
import { defineInputRule } from '@prosekit/extensions/input-rule'
import {
  defineListCommands,
  defineListDropIndicator,
  defineListKeymap,
  defineListSpec,
  toggleList,
  wrapInList,
  type ListAttrs,
} from '@prosekit/extensions/list'
import type { ProseMirrorNode } from '@prosekit/pm/model'
import { Plugin } from '@prosekit/pm/state'
import type { Command, EditorState } from '@prosekit/pm/state'
import {
  createListRenderingPlugin,
  createSafariInputMethodWorkaroundPlugin,
  createToggleCollapsedCommand,
  defaultAttributesGetter,
  findCheckboxInListItem,
  handleListMarkerMouseDown,
  joinListElements,
  listToDOM,
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

// Each attr persists only its non-canonical values (`.`, `-`, `x`, and a gap
// of 1 are the defaults the serializer emits anyway); the rest must survive an
// editor DOM re-parse.
function serializeListMarker(value: ListMarker | undefined): string | undefined {
  return value === ')' || value === '*' || value === '+' ? value : undefined
}

function serializeTaskMarker(value: TaskMarker | undefined): string | undefined {
  return value === 'X' ? value : undefined
}

// A gap of 5+ is indented code, a different structure, so it never reaches here.
function serializeMarkerGap(value: number | null | undefined): string | undefined {
  return isValidMarkerGap(value) ? String(value) : undefined
}

type ListMarkerExtension = Extension<{ Nodes: { list: { marker?: ListMarker } } }>

function defineListMarkerAttr(): ListMarkerExtension {
  return defineNodeAttr<'list', 'marker', ListMarker>({
    type: 'list' satisfies NodeName,
    attr: 'marker',
    default: null,
    // A new item created by pressing Enter keeps the previous item's delimiter.
    splittable: true,
    toDOM: (value) => {
      const serialized = serializeListMarker(value)
      return serialized == null ? null : ['data-list-marker', serialized]
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
    toDOM: (value) => {
      const serialized = serializeTaskMarker(value)
      return serialized == null ? null : ['data-list-task-marker', serialized]
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
    toDOM: (value) => {
      const serialized = serializeMarkerGap(value)
      return serialized == null ? null : ['data-list-marker-gap', serialized]
    },
    parseDOM: (node) => {
      const value = Number.parseInt(node.getAttribute('data-list-marker-gap') ?? '', 10)
      return isValidMarkerGap(value) ? value : 1
    },
  })
}

function getListClipboardAttributes(node: ProseMirrorNode): Record<string, string | undefined> {
  const attrs = node.attrs as MeowdownListAttrs
  return {
    ...defaultAttributesGetter(node),
    'data-list-marker': serializeListMarker(attrs.marker),
    'data-list-task-marker': serializeTaskMarker(attrs.taskMarker),
    'data-list-marker-gap': serializeMarkerGap(attrs.markerGap),
  }
}

/**
 * Serialize copied lists as native `<ul>`/`<ol>` elements, mirroring ProseKit's
 * `defineListSerializer`, but with an attribute getter that keeps meowdown's
 * marker attrs, which `listToDOM`'s default getter drops. Without them, a round
 * task `+ [ ]` copied or dragged into another editor turns into a square
 * `- [ ]`.
 */
function defineMeowdownListSerializer(): PlainExtension {
  return defineClipboardSerializer({
    serializeFragmentWrapper: (serializeFragment) => {
      return (...args) => {
        const dom = serializeFragment(...args)
        return normalizeElementTree(joinListElements(dom))
      }
    },
    serializeNodeWrapper: (serializeNode) => {
      return (...args) => {
        const dom = serializeNode(...args)
        return isElementLike(dom) ? normalizeElementTree(joinListElements(dom)) : dom
      }
    },
    nodesFromSchemaWrapper: (nodesFromSchema) => {
      return (...args) => {
        const nodes = nodesFromSchema(...args)
        return {
          ...nodes,
          list: (node) =>
            listToDOM({ node, nativeList: true, getAttributes: getListClipboardAttributes }),
        }
      }
    },
  })
}

function normalizeElementTree<T extends Element | DocumentFragment>(node: T): T {
  if (isElementLike(node)) {
    normalizeTaskList(node)
  }

  for (const child of node.children) {
    normalizeElementTree(child)
  }

  return node
}

/**
 * Modifies the DOM tree for task lists to ensure that the output HTML can be
 * parsed by rehype-remark.
 */
function normalizeTaskList(node: Element): void {
  if (
    !node.classList.contains('prosemirror-flat-list') ||
    node.getAttribute('data-list-kind') !== 'task' ||
    node.children.length !== 2
  ) {
    return
  }

  const marker = node.children.item(0)
  if (!marker || !marker.classList.contains('list-marker')) {
    return
  }

  const checkbox = findCheckboxInListItem(marker)
  if (!checkbox) {
    return
  }

  const content = node.children.item(1)
  if (!content || !content.classList.contains('list-content')) {
    return
  }

  const textBlock = content.children.item(0)
  if (!textBlock || !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(textBlock.tagName)) {
    return
  }

  node.replaceChildren(...content.children)
  textBlock.prepend(checkbox)
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
  wrappingListInputRule<MeowdownListAttrs>(/^\s?\[([\sX]?)\]\s$/i, ({ match }) => {
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
 * Cycle the selected block between square and circle checkbox tasks. Non-task
 * content becomes an unchecked square task; shape changes preserve checked state.
 */
function cycleCheckableList(): Command {
  return (state, dispatch, view) => {
    const attrs = getListAttrsAtSelection(state)
    const command =
      attrs?.kind !== 'task'
        ? wrapInList<MeowdownListAttrs>({ kind: 'task', marker: null, checked: false })
        : attrs.marker === '+'
          ? wrapInSquareTask()
          : wrapInCircleTask()
    return command(state, dispatch, view)
  }
}

function defineTaskCommands() {
  return defineCommands({
    cycleCheckableList,
    wrapInCircleTask,
    wrapInSquareTask,
  })
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

function defineMeowdownListKeymap(): PlainExtension {
  return defineKeymap({
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
    defineMeowdownListSerializer(),
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
