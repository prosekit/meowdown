import type { SyntaxNode } from '@lezer/common'
import type { EditorNode } from '@prosekit/pm/model'

import { gfmParser } from '../lezer/parser.ts'

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
}

const ESCAPABLE_PUNCTUATION_RE = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g

function unescapePunctuation(value: string): string {
  return value.replaceAll(ESCAPABLE_PUNCTUATION_RE, '$1')
}

/** CommonMark label normalization: unescape, collapse whitespace, and case-fold. */
export function normalizeReferenceLabel(label: string): string {
  return unescapePunctuation(label)
    .trim()
    .replaceAll(/[\t\n\r ]+/g, ' ')
    .normalize('NFC')
    .toLowerCase()
}

function destinationValue(raw: string): string {
  const unwrapped = raw.startsWith('<') && raw.endsWith('>') ? raw.slice(1, -1) : raw
  return unescapePunctuation(unwrapped)
}

function titleValue(raw: string): string {
  return raw.length >= 2 ? unescapePunctuation(raw.slice(1, -1)) : ''
}

function firstReferenceNode(text: string): SyntaxNode | null {
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

/** Collect document-wide definitions from source-backed textblocks. */
export function collectReferenceDefinitions(doc: EditorNode): ReferenceDefinitionIndex {
  const definitions = new Map<string, ReferenceDefinition>()
  doc.descendants((node) => {
    if (node.type.spec.code) return false
    if (!node.isTextblock) return true
    const definition = parseReferenceDefinition(node.textContent)
    if (definition !== null && !definitions.has(definition.key)) {
      definitions.set(definition.key, definition)
    }
    return false
  })
  const signature = JSON.stringify(
    [...definitions].map(([key, definition]) => [key, definition.href, definition.title]),
  )
  return { definitions, signature }
}
