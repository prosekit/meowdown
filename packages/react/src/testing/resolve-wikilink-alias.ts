import type { WikilinkResolver } from '@meowdown/core'

/**
 * A host resolver that splits `[[target|alias]]` into its target and label.
 */
export const resolveWikilinkAlias: WikilinkResolver = ({ target }) => {
  const pipe = target.indexOf('|')
  if (pipe < 0) return
  return { target: target.slice(0, pipe).trim(), display: target.slice(pipe + 1).trim() }
}
