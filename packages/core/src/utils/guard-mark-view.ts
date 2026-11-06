import type { MarkView, MarkViewConstructor } from '@prosekit/pm/view'

/**
 * Wrap a mark view constructor so that a throw from it, or from the view's
 * `update` or `destroy`, is reported with `reportError` instead of leaving
 * ProseMirror's view tree half updated. A constructor that throws gets a bare
 * `<span>`, which keeps the mark's source text editable.
 */
export function guardMarkView(constructor: MarkViewConstructor): MarkViewConstructor {
  return (mark, view, inline) => {
    let markView: MarkView
    try {
      markView = constructor(mark, view, inline)
    } catch (error) {
      reportError(error)
      return { dom: document.createElement('span') }
    }
    return {
      dom: markView.dom,
      contentDOM: markView.contentDOM,
      ignoreMutation: markView.ignoreMutation?.bind(markView),
      update: (next) => {
        try {
          return markView.update?.(next) ?? false
        } catch (error) {
          reportError(error)
          return false
        }
      },
      destroy: () => {
        try {
          markView.destroy?.()
        } catch (error) {
          reportError(error)
        }
      },
    }
  }
}
