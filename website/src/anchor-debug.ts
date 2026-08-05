// Temporary instrumentation for the iOS atom-anchor experiment. Attributes
// every selection movement to its writer: JS-initiated writes (ProseMirror)
// go through the wrapped Selection methods and log a `W` line at call time;
// a `selectionchange` with no recent `W` line means the browser moved the
// selection on its own. Delete with the experiment branch.

const start = performance.now()
let lastWriteTime = -1

function stamp(): string {
  return (performance.now() - start).toFixed(1)
}

function describeElement(el: Element | null): string {
  if (el == null) return 'null'
  const name = el.nodeName.toLowerCase()
  const className = typeof el.className === 'string' && el.className ? el.className : ''
  return className ? `${name}.${className.replaceAll(' ', '.')}` : name
}

function describeDOMPosition(node: unknown, offset: unknown): string {
  if (!(node instanceof Node)) return String(node)
  if (node.nodeType === Node.TEXT_NODE) {
    const text = JSON.stringify((node.nodeValue ?? '').slice(0, 24))
    return `text(${text})@${describeElement(node.parentElement)}+${String(offset)}`
  }
  return `${describeElement(node as Element)}+${String(offset)}`
}

function log(...args: unknown[]): void {
  console.log('[anchor-debug]', ...args)
}

const METHODS = ['collapse', 'extend', 'setBaseAndExtent', 'addRange', 'removeAllRanges'] as const

export function installAnchorDebug(): void {
  for (const method of METHODS) {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- re-applied with the original `this` below
    const original = Selection.prototype[method] as (this: Selection, ...args: unknown[]) => unknown
    Object.defineProperty(Selection.prototype, method, {
      value: function (this: Selection, ...args: unknown[]) {
        lastWriteTime = performance.now()
        log(stamp(), `W ${method}`, describeDOMPosition(args[0], args[1]))
        return original.apply(this, args)
      },
    })
  }
  document.addEventListener('selectionchange', () => {
    const sel = document.getSelection()
    const sinceWrite = lastWriteTime < 0 ? Infinity : performance.now() - lastWriteTime
    log(
      stamp(),
      `S anchor=${describeDOMPosition(sel?.anchorNode ?? null, sel?.anchorOffset ?? 0)}`,
      sinceWrite < 30
        ? `js-write ${sinceWrite.toFixed(0)}ms ago`
        : 'no recent js write (browser moved it)',
    )
  })
  log('installed')
}
