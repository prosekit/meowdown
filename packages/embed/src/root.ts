import type { HostElement } from '@aria-ui/core'

/**
 * The direct `<div data-root>` child that holds the rendered snapshot. Reused
 * across updates so other children the host appended survive; created on
 * first use.
 */
export function getRootContainer(host: HostElement): HTMLDivElement {
  let container = host.querySelector<HTMLDivElement>(':scope > div[data-root]')
  if (!container) {
    container = host.ownerDocument.createElement('div')
    container.dataset.root = ''
    host.append(container)
  }
  return container
}
