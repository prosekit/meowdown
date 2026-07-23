import { gfmParser, LEZER_NODE_IDS, type SyntaxNode } from '@meowdown/markdown'
import type { EditorNode } from '@prosekit/pm/model'
import type { Transaction } from '@prosekit/pm/state'
import { AttrStep } from '@prosekit/pm/transform'
import { decodeString } from 'micromark-util-decode-string'
import { normalizeIdentifier } from 'micromark-util-normalize-identifier'

import { isNodeOfType } from './node-names.ts'

export interface ReferenceDefinition {
  key: string
  href: string
  title: string
}

export type ReferenceDefinitions = ReadonlyMap<string, ReferenceDefinition>

export interface ReferenceDefinitionIndex {
  definitions: ReferenceDefinitions
  nodes: ReadonlySet<EditorNode>
}

const MAX_DEFINITION_LENGTH = 1_024

export function normalizeReferenceLabel(label: string): string {
  return normalizeIdentifier(label)
}

function mayBeReferenceDefinition(text: string): boolean {
  if (text.length > MAX_DEFINITION_LENGTH) return false
  const first = text.search(/\S/)
  if (first < 0 || text.charCodeAt(first) !== 91) return false
  return text.includes(']:', first + 1)
}

function getReferenceNode(text: string): SyntaxNode | undefined {
  if (!mayBeReferenceDefinition(text)) return

  const root = gfmParser.parse(text).topNode
  const reference = root.firstChild
  if (reference?.type.id !== LEZER_NODE_IDS.LinkReference) return
  if (reference.nextSibling != null) return
  return reference
}

function decodeDestination(raw: string): string {
  const value = raw.startsWith('<') && raw.endsWith('>') ? raw.slice(1, -1) : raw
  return decodeString(value)
}

function decodeTitle(raw: string): string {
  return raw.length < 2 ? '' : decodeString(raw.slice(1, -1))
}

export function parseReferenceDefinition(text: string): ReferenceDefinition | undefined {
  const reference = getReferenceNode(text)
  if (reference == null) return

  const label = reference.getChild('LinkLabel')
  const destination = reference.getChild('URL')
  if (label == null || destination == null) return

  const key = normalizeReferenceLabel(text.slice(label.from + 1, label.to - 1))
  if (key === '') return

  const title = reference.getChild('LinkTitle')
  return {
    key,
    href: decodeDestination(text.slice(destination.from, destination.to)),
    title: title == null ? '' : decodeTitle(text.slice(title.from, title.to)),
  }
}

function isDefinitionContainer(parent: EditorNode | null, index: number): boolean {
  if (parent == null) return true
  if (isNodeOfType(parent, 'tableCell') || isNodeOfType(parent, 'tableHeaderCell')) return false
  return !isNodeOfType(parent, 'list') || parent.attrs.kind !== 'task' || index > 0
}

function isDefinitionTextblock(
  node: EditorNode,
  parent: EditorNode | null,
  index: number,
): boolean {
  return isNodeOfType(node, 'paragraph') && isDefinitionContainer(parent, index)
}

const definitionCache = new WeakMap<EditorNode, ReferenceDefinition | undefined>()

function getDefinition(
  node: EditorNode,
  parent: EditorNode | null,
  index: number,
): ReferenceDefinition | undefined {
  if (!isDefinitionTextblock(node, parent, index)) return
  if (definitionCache.has(node)) return definitionCache.get(node)

  const definition = parseReferenceDefinition(node.textContent)
  definitionCache.set(node, definition)
  return definition
}

export function isReferenceDefinitionNode(
  node: EditorNode,
  parent: EditorNode | null,
  index: number,
): boolean {
  return getDefinition(node, parent, index) != null
}

export function collectReferenceDefinitions(doc: EditorNode): ReferenceDefinitionIndex {
  const definitions = new Map<string, ReferenceDefinition>()
  const nodes = new Set<EditorNode>()

  doc.descendants((node, _position, parent, index) => {
    if (node.type.spec.code) return false
    if (!node.isTextblock) return true

    const definition = getDefinition(node, parent, index)
    if (definition != null) {
      nodes.add(node)
      if (!definitions.has(definition.key)) {
        definitions.set(definition.key, definition)
      }
    }
    return false
  })

  return { definitions, nodes }
}

function rangeHasDefinitionCandidate(doc: EditorNode, from: number, to: number): boolean {
  const docSize = doc.content.size
  let found = false
  doc.nodesBetween(
    Math.max(0, from - 1),
    Math.min(docSize, to + 1),
    (node, _position, parent, index) => {
      if (found || node.type.spec.code) return false
      if (!node.isTextblock) return true
      if (
        isDefinitionTextblock(node, parent, index) &&
        (definitionCache.has(node)
          ? definitionCache.get(node) != null
          : mayBeReferenceDefinition(node.textContent))
      ) {
        found = true
      }
      return false
    },
  )
  return found
}

function transactionTouchesDefinitions(transaction: Transaction): boolean {
  // AttrStep changes node attributes but exposes StepMap.empty. A list kind
  // change can make its first paragraph eligible or ineligible as a definition,
  // so there is no mapped range to inspect and the index must be rebuilt.
  if (transaction.steps.some((step) => step instanceof AttrStep)) return true

  for (const [index, map] of transaction.mapping.maps.entries()) {
    const before = transaction.docs[index]
    const after =
      index + 1 < transaction.docs.length ? transaction.docs[index + 1] : transaction.doc
    let touched = false
    map.forEach((oldStart, oldEnd, newStart, newEnd) => {
      if (touched) return
      touched =
        rangeHasDefinitionCandidate(before, oldStart, oldEnd) ||
        rangeHasDefinitionCandidate(after, newStart, newEnd)
    })
    if (touched) return true
  }
  return false
}

export function updateReferenceDefinitions(
  previous: ReferenceDefinitionIndex,
  transaction: Transaction,
  doc: EditorNode,
): ReferenceDefinitionIndex {
  if (!transaction.docChanged || !transactionTouchesDefinitions(transaction)) return previous
  return collectReferenceDefinitions(doc)
}
