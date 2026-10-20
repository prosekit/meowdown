/**
 * Mounts a fixed element that covers the top `height` pixels of the viewport,
 * for use as an editor's `collisionBoundary`.
 */
export function setupCollisionBoundary(height: number): Disposable & { element: Element } {
  const element = document.createElement('div')
  element.style.cssText = `position: fixed; top: 0; left: 0; right: 0; height: ${height}px; pointer-events: none`
  document.body.append(element)
  return { element, [Symbol.dispose]: () => element.remove() }
}
