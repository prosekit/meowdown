import el from 'crelt'

import { getSafeUrl } from './safe-url.ts'

export function renderLink(content: string | Node, destination?: string) {
  const href = destination && getSafeUrl(destination)
  return href ? el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, content) : content
}
