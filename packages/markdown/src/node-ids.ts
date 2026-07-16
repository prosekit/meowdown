import type { MarkdownParser } from '@lezer/markdown'

import type { LezerNodeName } from './node-names.ts'
import { gfmParser } from './parser.ts'

function lezerNodeIdsByName(parser: MarkdownParser): Readonly<Record<string, number>> {
  const ids: Record<string, number> = {}
  for (const t of parser.nodeSet.types) ids[t.name] = t.id
  return ids
}

/**
 * Cached node name -> node id lookup for the project-wide `gfmParser`.
 */
export const LEZER_NODE_IDS: Readonly<Record<LezerNodeName, number>> = lezerNodeIdsByName(gfmParser)
