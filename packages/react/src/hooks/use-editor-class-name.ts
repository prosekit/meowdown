import { useCallback, useLayoutEffect, useRef } from 'react'

function tokenize(className: string): string[] {
  return className.split(/\s+/).filter(Boolean)
}

/**
 * Applies host classes to the element ProseMirror mounts into, without handing
 * React the element's `class` attribute.
 *
 * ProseMirror puts `ProseMirror` (and `ProseMirror-focused` while focused) on
 * that element itself, via `classList`, so it composes with whatever else is
 * there. React's `className` prop is a whole-attribute write, so a re-render
 * with a changed class — a host swapping a size class, say — silently drops
 * ProseMirror's tokens, and every `.ProseMirror …` rule in the stylesheet stops
 * matching until the editor remounts. That leaves raw Markdown source visible
 * wherever `.ProseMirror .md-atom-view-content` had hidden it, and kills the
 * virtual caret's `.ProseMirror-focused` styling.
 *
 * Syncing token by token keeps both writers additive: only classes this hook
 * applied itself are ever removed.
 *
 * @param className Space-separated classes for the editable root.
 * @returns A ref callback recording the mounted element, to compose with
 *   `editor.mount`. Pass `null` to detach.
 */
export function useEditorClassName(className: string): (element: HTMLElement | null) => void {
  const elementRef = useRef<HTMLElement | null>(null)
  const appliedRef = useRef<string[]>([])

  // Runs on every render (mount included, after the ref callback below has
  // recorded the element) and is a layout effect because these classes carry
  // layout: they must land before the render they belong to is painted.
  useLayoutEffect(() => {
    const element = elementRef.current
    if (element === null) return
    const applied = appliedRef.current
    const next = tokenize(className)
    for (const token of applied) {
      if (!next.includes(token)) element.classList.remove(token)
    }
    for (const token of next) {
      if (!applied.includes(token)) element.classList.add(token)
    }
    appliedRef.current = next
  })

  return useCallback((element: HTMLElement | null): void => {
    elementRef.current = element
    // A remount starts from a bare element, so forget what the previous one
    // carried; otherwise the shared tokens would be skipped as "already applied".
    if (element === null) appliedRef.current = []
  }, [])
}
