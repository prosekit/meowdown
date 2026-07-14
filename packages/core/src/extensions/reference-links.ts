import type { SyntaxNode } from '@lezer/common'
import type { EditorNode } from '@prosekit/pm/model'
import type { Transaction } from '@prosekit/pm/state'
import { decodeString } from 'micromark-util-decode-string'
import { normalizeIdentifier } from 'micromark-util-normalize-identifier'

import { gfmParser } from '../lezer/parser.ts'

let definitionParseCount = 0

/** @internal Test instrumentation for definition parser work. */
export function resetReferenceDefinitionParseCount(): void {
  definitionParseCount = 0
}

/** @internal Test instrumentation for definition parser work. */
export function getReferenceDefinitionParseCount(): number {
  return definitionParseCount
}

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

/** Document-scoped reference definitions plus a stable cache identity. */
export interface ReferenceDefinitionIndex {
  definitions: ReferenceDefinitions
  signature: string
  /** Source-backed definition blocks, including shadowed duplicates. */
  entries: readonly ReferenceDefinitionEntry[]
  /** Immutable editor nodes that are actual definition blocks. */
  nodes: ReadonlySet<EditorNode>
}

/** One source-backed definition block and its current document position. */
export interface ReferenceDefinitionEntry {
  node: EditorNode
  position: number
  definition: ReferenceDefinition
}

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

function firstReferenceNode(text: string): SyntaxNode | null {
  definitionParseCount++
  let reference: SyntaxNode | null = null
  gfmParser.parse(text).iterate({
    enter(node) {
      if (node.name !== 'LinkReference') return true
      reference = node.node
      return false
    },
  })
  return reference
}

/** Parse one complete CommonMark link-reference definition textblock. */
export function parseReferenceDefinition(text: string): ReferenceDefinition | null {
  const firstNonWhitespace = text.search(/\S/)
  if (firstNonWhitespace < 0 || text[firstNonWhitespace] !== '[' || !text.includes(']:')) {
    return null
  }
  const reference = firstReferenceNode(text)
  if (reference === null) return null
  const labelNode = reference.getChild('LinkLabel')
  const urlNode = reference.getChild('URL')
  if (labelNode === null || urlNode === null) return null

  const key = normalizeReferenceLabel(text.slice(labelNode.from + 1, labelNode.to - 1))
  if (key === '') return null
  const titleNode = reference.getChild('LinkTitle')
  return {
    key,
    href: destinationValue(text.slice(urlNode.from, urlNode.to)),
    title: titleNode === null ? '' : titleValue(text.slice(titleNode.from, titleNode.to)),
  }
}

function isDefinitionContainer(parent: EditorNode | null, index: number): boolean {
  if (parent === null) return true
  if (parent.type.name === 'tableCell' || parent.type.name === 'tableHeaderCell') return false
  return parent.type.name !== 'list' || parent.attrs.kind !== 'task' || index > 0
}

/** Whether an editor textblock can represent a CommonMark definition block. */
function isReferenceDefinitionTextblock(
  node: EditorNode,
  parent: EditorNode | null,
  index: number,
): boolean {
  return node.type.name === 'paragraph' && isDefinitionContainer(parent, index)
}

function buildReferenceDefinitionIndex(
  entries: readonly ReferenceDefinitionEntry[],
): ReferenceDefinitionIndex {
  const orderedEntries = [...entries].sort((left, right) => left.position - right.position)
  const definitions = new Map<string, ReferenceDefinition>()
  for (const entry of orderedEntries) {
    if (!definitions.has(entry.definition.key)) {
      definitions.set(entry.definition.key, entry.definition)
    }
  }
  const signature = JSON.stringify(
    [...definitions].map(([key, definition]) => [key, definition.href, definition.title]),
  )
  return {
    definitions,
    signature,
    entries: orderedEntries,
    nodes: new Set(orderedEntries.map((entry) => entry.node)),
  }
}

function referenceDefinitionEntry(
  node: EditorNode,
  position: number,
  parent: EditorNode | null,
  index: number,
): ReferenceDefinitionEntry | null {
  if (!isReferenceDefinitionTextblock(node, parent, index)) return null
  const definition = parseReferenceDefinition(node.textContent)
  return definition === null ? null : { node, position, definition }
}

/** Collect document-wide definitions from source-backed textblocks. */
export function collectReferenceDefinitions(doc: EditorNode): ReferenceDefinitionIndex {
  const entries: ReferenceDefinitionEntry[] = []
  doc.descendants((node, position, parent, index) => {
    if (node.type.spec.code) return false
    if (!node.isTextblock) return true
    const entry = referenceDefinitionEntry(node, position, parent, index)
    if (entry !== null) entries.push(entry)
    return false
  })
  return buildReferenceDefinitionIndex(entries)
}

function changedRanges(transaction: Transaction): readonly { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = []
  for (const [index, stepMap] of transaction.mapping.maps.entries()) {
    const remaining = transaction.mapping.slice(index + 1)
    stepMap.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      const from = remaining.map(newStart, -1)
      const to = remaining.map(newEnd, 1)
      ranges.push({ from: Math.min(from, to), to: Math.max(from, to) })
    })
  }
  return ranges
}

function contextAt(doc: EditorNode, position: number): { parent: EditorNode; index: number } {
  const resolved = doc.resolve(position)
  return { parent: resolved.parent, index: resolved.index() }
}

/**
 * Incrementally refresh definitions after one document transaction.
 * Unchanged immutable blocks are retained; only textblocks around changed
 * ranges are reparsed.
 */
export function updateReferenceDefinitions(
  previous: ReferenceDefinitionIndex,
  transaction: Transaction,
  doc: EditorNode,
): ReferenceDefinitionIndex {
  if (!transaction.docChanged) return previous

  const entriesByNode = new Map<EditorNode, ReferenceDefinitionEntry>()
  for (const entry of previous.entries) {
    const mapped = transaction.mapping.mapResult(entry.position, 1)
    const node = doc.nodeAt(mapped.pos)
    const context = contextAt(doc, mapped.pos)
    if (
      !mapped.deleted &&
      node === entry.node &&
      isReferenceDefinitionTextblock(node, context.parent, context.index)
    ) {
      entriesByNode.set(node, { ...entry, position: mapped.pos })
    }
  }

  const docSize = doc.content.size
  for (const range of changedRanges(transaction)) {
    const from = Math.max(0, range.from - 1)
    const to = Math.min(docSize, range.to + 1)
    doc.nodesBetween(from, to, (node, position, parent, index) => {
      if (node.type.spec.code) return false
      if (!node.isTextblock) return true
      entriesByNode.delete(node)
      const entry = referenceDefinitionEntry(node, position, parent, index)
      if (entry !== null) entriesByNode.set(node, entry)
      return false
    })
  }

  return buildReferenceDefinitionIndex([...entriesByNode.values()])
}

/** Rebind immutable definition-node identities after a position-preserving mark step. */
export function rebindReferenceDefinitionNodes(
  previous: ReferenceDefinitionIndex,
  doc: EditorNode,
): ReferenceDefinitionIndex {
  const entries: ReferenceDefinitionEntry[] = []
  for (const entry of previous.entries) {
    const node = doc.nodeAt(entry.position)
    const context = contextAt(doc, entry.position)
    if (
      node !== null &&
      node.textContent === entry.node.textContent &&
      isReferenceDefinitionTextblock(node, context.parent, context.index)
    ) {
      entries.push({ ...entry, node })
    }
  }
  return buildReferenceDefinitionIndex(entries)
}
