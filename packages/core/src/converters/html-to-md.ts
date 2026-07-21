import { once } from '@ocavue/utils'
import type { Element } from 'hast'
import { defaultHandlers, type Handle as HastToMdastHandle } from 'hast-util-to-mdast'
import type { Parent, PhrasingContent, Text } from 'mdast'
import {
  defaultHandlers as mdastDefaultHandlers,
  type Handle as MdastToMarkdownHandle,
  type Unsafe,
} from 'mdast-util-to-markdown'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'

/**
 * Inline highlight node for `==text==`. Standard mdast has no such node, so it
 * is registered here and serialized by `highlightToMarkdown`.
 */
interface Highlight extends Parent {
  type: 'highlight'
  children: PhrasingContent[]
}

declare module 'mdast' {
  interface PhrasingContentMap {
    highlight: Highlight
  }
  interface RootContentMap {
    highlight: Highlight
  }
}

/**
 * Convert a `<mark>` element into a `highlight` node. There is no built-in
 * `hast-util-to-mdast` handler for `<mark>`, so without this the highlight is
 * dropped and only its text survives.
 */
const markToHighlight: HastToMdastHandle = (state, element) => {
  const result: Highlight = {
    type: 'highlight',
    children: state.all(element) as PhrasingContent[],
  }
  state.patch(element, result)
  return result
}

/**
 * Serialize a `highlight` node as `==text==`. The `==` delimiters are written
 * through the construct machinery (not as plain text) so they are never
 * escaped: a leading `=` written as text would otherwise become `\=` to guard
 * against a setext heading underline. Mirrors `mdast-util-gfm-strikethrough`.
 */
const highlightToMarkdown: MdastToMarkdownHandle = (node, _parent, state, info) => {
  const highlight = node as Highlight
  const tracker = state.createTracker(info)
  let value = tracker.move('==')
  value += tracker.move(
    state.containerPhrasing(highlight, { ...tracker.current(), before: value, after: '=' }),
  )
  value += tracker.move('==')
  return value
}

function isCheckboxInput(node: Element): boolean {
  return node.tagName === 'input' && node.properties.type === 'checkbox'
}

/** The first checkbox `<input>` in `node`'s subtree, if any. */
function findCheckbox(node: Element): Element | undefined {
  for (const child of node.children) {
    if (child.type !== 'element') continue
    if (isCheckboxInput(child)) return child
    const nested = findCheckbox(child)
    if (nested) return nested
  }
  return undefined
}

/**
 * Rebuild a ProseMirror-editor task item as the plain GFM shape. Tiptap
 * (`<li data-checked="true" data-type="taskItem"><label><input …></label>
 * <div><p>text</p></div></li>`) and remirror/Reflect-style (`<li data-checked>`)
 * items nest the checkbox inside a `<label>` and the body inside a `<div>`,
 * which the default `li` handler does not recognize: the item would serialize
 * as a plain bullet whose literal `[ ]` text then gets escaped. Returns
 * `undefined` for anything that is not a task item.
 */
function normalizeTaskItem(node: Element): Element | undefined {
  const dataChecked = node.properties.dataChecked
  const checkbox = findCheckbox(node)
  const isTask =
    dataChecked != null ||
    node.properties.dataType === 'taskItem' ||
    node.properties.dataTaskListItem != null ||
    checkbox !== undefined
  if (!isTask) return undefined
  // Tiptap writes data-checked="true"/"false"; remirror marks checked items
  // with a bare data-checked attribute (parsed as an empty string).
  const checked =
    typeof dataChecked === 'string'
      ? dataChecked !== 'false'
      : Boolean(checkbox?.properties.checked)

  // Drop the checkbox UI: bare checkbox inputs and any label wrapping one.
  let content = node.children.filter((child) => {
    if (child.type !== 'element') return true
    if (isCheckboxInput(child)) return false
    if (child.tagName === 'label' && findCheckbox(child)) return false
    return true
  })
  // Unwrap the single `<div>` tiptap places the item body in, then a single
  // `<p>` body down to phrasing so the item serializes tight (`- [ ] text`).
  for (const tagName of ['div', 'p']) {
    const only = content.length === 1 && content[0].type === 'element' ? content[0] : undefined
    if (only?.tagName === tagName) content = only.children
  }
  const input: Element = {
    type: 'element',
    tagName: 'input',
    properties: { type: 'checkbox', checked },
    children: [],
  }
  return { ...node, children: [input, ...content] }
}

/** `li` handler that recognizes ProseMirror-style task items, then delegates. */
const taskAwareListItem: HastToMdastHandle = (state, element) => {
  return defaultHandlers.li(state, normalizeTaskItem(element) ?? element)
}

/**
 * Narrow the stock escaping rules to meowdown's dialect: drop the blanket
 * "escape every `[` and `~`" rules, keep the `[`/`]` rules scoped to link
 * labels and the line-leading `~` fence guard (a bare `~~~` would open a
 * code fence that swallows the following content on reparse).
 */
function toMeowdownUnsafe(unsafe: Unsafe[]): Unsafe[] {
  return unsafe.filter((pattern) => {
    if (pattern.character !== '[' && pattern.character !== '~') return true
    if (pattern.atBreak) return pattern.character === '~'
    const constructs = Array.isArray(pattern.inConstruct)
      ? pattern.inConstruct
      : pattern.inConstruct
        ? [pattern.inConstruct]
        : []
    return !constructs.includes('phrasing')
  })
}

/**
 * Serialize a text node with the narrowed escaping rules. The default `text`
 * handler reads `state.safe` off the state it is given, so passing a clone
 * with a filtered `unsafe` scopes the narrowing to text nodes without
 * mutating the shared serializer state.
 */
const textToMarkdown: MdastToMarkdownHandle = (node, parent, state, info) => {
  return mdastDefaultHandlers.text(
    node as Text,
    parent,
    { ...state, unsafe: toMeowdownUnsafe(state.unsafe) },
    info,
  )
}

function createProcessor() {
  return unified()
    .use(rehypeParse)
    .use(rehypeRemark, { handlers: { mark: markToHighlight, li: taskAwareListItem } })
    .use(remarkGfm)
    .use(remarkStringify, {
      bullet: '-',
      emphasis: '*',
      strong: '*',
      fence: '`',
      fences: true,
      rule: '-',
      ruleRepetition: 3,
      listItemIndent: 'one',
      handlers: { highlight: highlightToMarkdown, text: textToMarkdown },
    })
    .freeze()
}

const getProcessor = once(createProcessor)

/** Convert HTML into Markdown text. */
export function htmlToMarkdown(html: string): string {
  return String(getProcessor().processSync(html))
}
