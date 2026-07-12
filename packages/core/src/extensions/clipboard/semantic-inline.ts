import { Fragment } from '@prosekit/pm/model'
import type { Mark, ProseMirrorNode, TagParseRule } from '@prosekit/pm/model'

import type {
  MdFileAttrs,
  MdImageAttrs,
  MdLinkTextAttrs,
  MdWikilinkAttrs,
} from '../inline-marks.ts'
import type { MarkName } from '../mark-names.ts'
import { isHTMLElement } from '@ocavue/utils'

/** Syntax characters, dropped from the semantic clipboard HTML. */
const SYNTAX_MARK_NAMES: ReadonlySet<string> = new Set<MarkName>([
  'mdMark',
  'mdLinkUri',
  'mdLinkTitle',
])

/** Marks covering a whole source unit, emitted as one replacement per unit. */
const ATOM_MARK_NAMES: ReadonlySet<string> = new Set<MarkName>([
  'mdImage',
  'mdWikilink',
  'mdMath',
  'mdFile',
])

const SEMANTIC_TAGS: Partial<Record<MarkName, string>> = {
  mdStrong: 'strong',
  mdEm: 'em',
  mdCode: 'code',
  mdDel: 'del',
  mdHighlight: 'mark',
  mdLinkText: 'a',
}

function findAtomMark(marks: readonly Mark[]): Mark | undefined {
  return marks.find((mark) => ATOM_MARK_NAMES.has(mark.type.name))
}

export function hasSyntaxMark(marks: readonly Mark[]): boolean {
  return marks.some((mark) => SYNTAX_MARK_NAMES.has(mark.type.name))
}

export interface InlineRun {
  atom: Mark | undefined
  text: string
  children: ProseMirrorNode[]
}

/**
 * Group a textblock's text nodes into atom units and plain runs. A unit's
 * text nodes share one mark instance (the inline parser creates each unit
 * mark once), so instance identity splits adjacent same-attrs units.
 */
export function groupInlineRuns(textblock: ProseMirrorNode): InlineRun[] {
  const runs: InlineRun[] = []
  textblock.forEach((child) => {
    if (!child.isText || !child.text) return
    const atom = findAtomMark(child.marks)
    const last = runs.at(-1)
    if (atom != null && last != null && last.atom === atom) {
      last.text += child.text
      last.children.push(child)
      return
    }
    runs.push({ atom, text: child.text, children: [child] })
  })
  return runs
}

/**
 * The semantic DOM of one textblock: `data-md` holds the full source text,
 * the children are the rendered inline content without syntax characters.
 */
export function semanticTextblockDOM(
  tagName: string,
  node: ProseMirrorNode,
  attrs: Record<string, string | undefined> = {},
): HTMLElement {
  const element = document.createElement(tagName)
  element.setAttribute('data-md', node.textContent)
  for (const [name, value] of Object.entries(attrs)) {
    if (value != null) element.setAttribute(name, value)
  }
  serializeSemanticInline(node, element)
  return element
}

/**
 * The clipboard parse rule for a textblock: the content comes from the
 * `data-md` source text verbatim, the semantic child elements are ignored.
 * The inline mark plugin re-derives marks after the paste transaction.
 */ // REVIEW: rename this function from sourceTextRule to createSourceTextRule
export function sourceTextRule(
  tag: string,
  node: string,
  getAttrs?: TagParseRule['getAttrs'],
): TagParseRule {
  return {
    tag: `${tag}[data-md]`,
    node,
    priority: 100,
    getAttrs,
    getContent: (dom, schema) => {
      // REVIEW: I've changed this a bit. I've added `isHTMLElement` runtime check.
      const element = isHTMLElement(dom) ? dom : undefined
      const source = element?.getAttribute('data-md') ?? ''
      return source ? Fragment.from(schema.text(source)) : Fragment.empty
    },
  }
}

interface OpenWrapper {
  mark: Mark
  element: HTMLElement
}

function serializeSemanticInline(textblock: ProseMirrorNode, out: HTMLElement): void {
  const open: OpenWrapper[] = []

  for (const run of groupInlineRuns(textblock)) {
    if (run.atom != null) {
      open.length = 0
      out.append(atomUnitDOM(run.atom, run.text))
      continue
    }
    for (const child of run.children) {
      if (hasSyntaxMark(child.marks)) continue
      const semantic = child.marks.filter((mark) => SEMANTIC_TAGS[mark.type.name as MarkName])
      syncOpenWrappers(open, semantic, out)
      const parent = open.at(-1)?.element ?? out
      appendTextWithBreaks(parent, child.text ?? '')
    }
  }
}

function syncOpenWrappers(open: OpenWrapper[], next: readonly Mark[], out: HTMLElement): void {
  let common = 0
  while (common < open.length && common < next.length && next[common].eq(open[common].mark)) {
    common++
  }
  open.length = common
  for (let index = common; index < next.length; index++) {
    const mark = next[index]
    const element = document.createElement(SEMANTIC_TAGS[mark.type.name as MarkName] ?? 'span')
    if (mark.type.name === ('mdLinkText' satisfies MarkName)) {
      element.setAttribute('href', (mark.attrs as MdLinkTextAttrs).href)
    }
    ;(open.at(-1)?.element ?? out).append(element)
    open.push({ mark, element })
  }
}

/** A soft break (a literal `\n` in the source) renders as `<br>`. */
function appendTextWithBreaks(parent: HTMLElement, text: string): void {
  const lines = text.split('\n')
  for (const [index, line] of lines.entries()) {
    if (index > 0) parent.append(document.createElement('br'))
    if (line) parent.append(document.createTextNode(line))
  }
}

// REVIEW: do not use globalThis.Node in the while codebase. Just use Node directly.
function atomUnitDOM(atom: Mark, sourceText: string): globalThis.Node {
  switch (atom.type.name as MarkName) {
    case 'mdImage': {
      const attrs = atom.attrs as MdImageAttrs
      const image = document.createElement('img')
      image.setAttribute('src', attrs.src)
      if (attrs.alt) image.setAttribute('alt', attrs.alt)
      if (attrs.title) image.setAttribute('title', attrs.title)
      if (attrs.width != null) image.setAttribute('width', String(attrs.width))
      if (attrs.height != null) image.setAttribute('height', String(attrs.height))
      return image
    }
    case 'mdWikilink': {
      const attrs = atom.attrs as MdWikilinkAttrs
      return document.createTextNode(attrs.display || attrs.target)
    }
    case 'mdFile': {
      const attrs = atom.attrs as MdFileAttrs
      const anchor = document.createElement('a')
      anchor.setAttribute('href', attrs.href)
      anchor.append(document.createTextNode(attrs.name || attrs.href))
      return anchor
    }
    // HTML has no standard math representation; the source text ($ included)
    // survives any markdown-aware consumer.
    case 'mdMath':
    default:
      return document.createTextNode(sourceText)
  }
}
