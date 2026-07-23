import { gfmParser, LEZER_NODE_IDS, type SyntaxNode } from '@meowdown/markdown'
import type { EditorNode } from '@prosekit/pm/model'
import type { Transaction } from '@prosekit/pm/state'
import { decodeString } from 'micromark-util-decode-string'
import { normalizeIdentifier } from 'micromark-util-normalize-identifier'

/** One CommonMark link-reference definition resolved for rendering. */
export interface ReferenceDefinition {
  /** Normalized label key used by full, collapsed, and shortcut references. */
  key: string
  /** Destination value with optional angle brackets removed. */
  href: string
  /** Unquoted definition title, or an empty string. */
  title: string
}

/** First-definition-wins lookup, matching CommonMark reference semantics. */
export type ReferenceDefinitions = ReadonlyMap<string, ReferenceDefinition>

/** Parse results per textblock node identity; `null` marks a non-definition. */
export type ReferenceDefinitionCache = WeakMap<EditorNode, ReferenceDefinition | null>

/** Document-wide definitions; rebuilt only when a definition-shaped block changes. */
export interface ReferenceIndex {
  definitions: ReferenceDefinitions
}

const EMPTY_DEFINITIONS: ReferenceDefinitions = new Map()

export const EMPTY_REFERENCE_INDEX: ReferenceIndex = { definitions: EMPTY_DEFINITIONS }

/**
 * A definition block is one line; longer blocks are prose that merely starts
 * like a definition, and parsing them on every keystroke is wasted work.
 */
const MAX_DEFINITION_LENGTH = 1024

/** CommonMark label normalization: collapse whitespace and Unicode case-fold. */
export function normalizeReferenceLabel(label: string): string {
  return normalizeIdentifier(label)
}

function destinationValue(raw: string): string {
  const unwrapped = raw.startsWith('<') && raw.endsWith('>') ? raw.slice(1, -1) : raw
  return decodeString(unwrapped)
}

function titleValue(raw: string): string {
  return raw.length >= 2 ? decodeString(raw.slice(1, -1)) : ''
}

/** `text` could open a definition: `[` after at most 3 spaces, with a `]:`. */
function isDefinitionShaped(text: string): boolean {
  if (text.length > MAX_DEFINITION_LENGTH) return false
  const first = text.search(/\S/)
  return first >= 0 && first <= 3 && text[first] === '[' && text.includes(']:')
}

/** Parse one textblock's text as a complete CommonMark link-reference definition. */
function parseReferenceDefinition(text: string): ReferenceDefinition | null {
  if (!isDefinitionShaped(text)) return null
  let reference: SyntaxNode | null = null
  gfmParser.parse(text).iterate({
    enter(node) {
      if (node.type.id !== LEZER_NODE_IDS.LinkReference) return true
      reference = node.node
      return false
    },
  })
  if (reference === null) return null
  const found: SyntaxNode = reference
  const labelNode = found.getChild('LinkLabel')
  const urlNode = found.getChild('URL')
  if (labelNode === null || urlNode === null) return null
  const key = normalizeReferenceLabel(text.slice(labelNode.from + 1, labelNode.to - 1))
  if (key === '') return null
  const titleNode = found.getChild('LinkTitle')
  return {
    key,
    href: destinationValue(text.slice(urlNode.from, urlNode.to)),
    title: titleNode === null ? '' : titleValue(text.slice(titleNode.from, titleNode.to)),
  }
}

/** Definition parse for one textblock, memoized on the immutable node identity. */
export function cachedDefinitionParse(
  node: EditorNode,
  cache: ReferenceDefinitionCache,
): ReferenceDefinition | null {
  const hit = cache.get(node)
  if (hit !== undefined) return hit
  const parsed = parseReferenceDefinition(node.textContent)
  cache.set(node, parsed)
  return parsed
}

function definitionsEqual(left: ReferenceDefinitions, right: ReferenceDefinitions): boolean {
  if (left.size !== right.size) return false
  for (const [key, definition] of right) {
    const other = left.get(key)
    if (
      other !== definition &&
      (other === undefined || other.href !== definition.href || other.title !== definition.title)
    ) {
      return false
    }
  }
  return true
}

/**
 * Scan the document's top-level paragraphs for definitions. Definitions are
 * deliberately top-level only: performance is preferred over CommonMark's
 * container support, and unchanged blocks hit `cache` by node identity.
 * Returns `previous` unchanged when the collected definitions are identical,
 * so callers can compare indexes by object identity.
 */
export function buildReferenceIndex(
  doc: EditorNode,
  cache: ReferenceDefinitionCache,
  previous?: ReferenceIndex,
): ReferenceIndex {
  let definitions: Map<string, ReferenceDefinition> | undefined
  doc.forEach((child) => {
    if (child.type.name !== 'paragraph' || child.childCount === 0) return
    const definition = cachedDefinitionParse(child, cache)
    if (definition === null) return
    definitions ??= new Map()
    if (!definitions.has(definition.key)) definitions.set(definition.key, definition)
  })
  const next = definitions ?? EMPTY_DEFINITIONS
  if (previous !== undefined && definitionsEqual(previous.definitions, next)) return previous
  if (previous === undefined && next === EMPTY_DEFINITIONS) return EMPTY_REFERENCE_INDEX
  return { definitions: next }
}

function rangeHasDefinitionShapedBlock(
  doc: EditorNode,
  from: number,
  to: number,
  cache: ReferenceDefinitionCache,
): boolean {
  const docSize = doc.content.size
  let found = false
  doc.nodesBetween(Math.max(0, from - 1), Math.min(docSize, to + 1), (node, _pos, parent) => {
    if (found || parent !== doc) return false
    if (node.type.name === 'paragraph') {
      const cached = cache.get(node)
      if (cached !== undefined ? cached !== null : isDefinitionShaped(node.textContent)) {
        found = true
      }
    }
    return false
  })
  return found
}

/**
 * Whether a transaction could have added, removed, or altered a definition
 * block. Checks the blocks around every step's ranges on both the before and
 * after documents, so a plain-paragraph keystroke costs one textblock guard
 * and steps without ranges (mark and attr steps, which cannot change any
 * block's text) never trigger an index rebuild.
 */
export function transactionTouchesDefinitions(
  transaction: Transaction,
  cache: ReferenceDefinitionCache,
): boolean {
  for (const [index, map] of transaction.mapping.maps.entries()) {
    const before = transaction.docs[index]
    const after =
      index + 1 < transaction.docs.length ? transaction.docs[index + 1] : transaction.doc
    let touched = false
    map.forEach((oldStart, oldEnd, newStart, newEnd) => {
      if (touched) return
      touched =
        rangeHasDefinitionShapedBlock(before, oldStart, oldEnd, cache) ||
        rangeHasDefinitionShapedBlock(after, newStart, newEnd, cache)
    })
    if (touched) return true
  }
  return false
}
