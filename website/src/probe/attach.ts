import { describeNode, record, snapshotSelection } from './recorder.ts'

export interface AttachOptions {
  /**
   * Record every `pointermove` / `touchmove` / `mousemove`. On by default: the
   * move stream during a caret drag is the point of the exercise. Turn it off
   * to compare a run against a quieter probe.
   */
  trackMoves?: boolean
}

function targetOf(event: Event): string {
  return describeNode(event.target instanceof Node ? event.target : undefined)
}

function pointerDetail(event: PointerEvent): Record<string, unknown> {
  return {
    target: targetOf(event),
    pointerType: event.pointerType,
    pointerId: event.pointerId,
    isPrimary: event.isPrimary,
    x: Math.round(event.clientX),
    y: Math.round(event.clientY),
    pressure: event.pressure,
    width: event.width,
    height: event.height,
    buttons: event.buttons,
    isTrusted: event.isTrusted,
  }
}

function touchDetail(event: TouchEvent): Record<string, unknown> {
  const touch = event.changedTouches[0]
  return {
    target: targetOf(event),
    touches: event.touches.length,
    changed: event.changedTouches.length,
    x: touch ? Math.round(touch.clientX) : undefined,
    y: touch ? Math.round(touch.clientY) : undefined,
    radiusX: touch?.radiusX,
    radiusY: touch?.radiusY,
    force: touch?.force,
    identifier: touch?.identifier,
    isTrusted: event.isTrusted,
  }
}

function mouseDetail(event: MouseEvent): Record<string, unknown> {
  return {
    target: targetOf(event),
    x: Math.round(event.clientX),
    y: Math.round(event.clientY),
    buttons: event.buttons,
    detail: event.detail,
    isTrusted: event.isTrusted,
  }
}

// `key`, `code` and `keyCode` together separate a Bluetooth keyboard from the
// iOS software keyboard, which is the whole question on the modality pages.
function keyDetail(event: KeyboardEvent): Record<string, unknown> {
  return {
    key: event.key,
    code: event.code,
    // Deprecated on purpose: the legacy `keyCode` is one of the few things that
    // separates an iOS software keyboard (229) from a Bluetooth one, and
    // telling them apart is the question this page exists to answer.
    // eslint-disable-next-line unicorn/prefer-keyboard-event-key
    keyCode: event.keyCode,
    location: event.location,
    repeat: event.repeat,
    isComposing: event.isComposing,
    isTrusted: event.isTrusted,
    shift: event.shiftKey,
    meta: event.metaKey,
    ctrl: event.ctrlKey,
    alt: event.altKey,
  }
}

function inputDetail(event: InputEvent): Record<string, unknown> {
  const ranges = event.getTargetRanges?.() ?? []
  return {
    inputType: event.inputType,
    data: event.data,
    isComposing: event.isComposing,
    isTrusted: event.isTrusted,
    targetRanges: ranges.map((range) => ({
      start: `${describeNode(range.startContainer)}+${range.startOffset}`,
      end: `${describeNode(range.endContainer)}+${range.endOffset}`,
    })),
  }
}

function mutationDetail(mutations: MutationRecord[]): Record<string, unknown> {
  return {
    count: mutations.length,
    records: mutations.slice(0, 8).map((mutation) => ({
      type: mutation.type,
      target: describeNode(mutation.target),
      added: mutation.addedNodes.length,
      removed: mutation.removedNodes.length,
      oldValue:
        mutation.oldValue == null
          ? undefined
          : mutation.oldValue.length > 32
            ? `${mutation.oldValue.slice(0, 32)}…`
            : mutation.oldValue,
    })),
  }
}

/**
 * Taps every input channel on `root` in the capture phase, so the recorded
 * order is the browser's dispatch order and does not depend on whether
 * ProseMirror stops an event.
 */
export function attachProbe(root: HTMLElement, options: AttachOptions = {}): () => void {
  const trackMoves = options.trackMoves ?? true
  const cleanups: (() => void)[] = []

  const on = <K extends keyof HTMLElementEventMap>(
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
  ) => {
    const listener = (event: Event) => handler(event as HTMLElementEventMap[K])
    root.addEventListener(type, listener, { capture: true, passive: true })
    cleanups.push(() => root.removeEventListener(type, listener, { capture: true }))
  }

  on('pointerdown', (event) =>
    record('event', 'pointerdown', pointerDetail(event), snapshotSelection()),
  )
  on('pointerup', (event) =>
    record('event', 'pointerup', pointerDetail(event), snapshotSelection()),
  )
  on('pointercancel', (event) => record('event', 'pointercancel', pointerDetail(event)))
  if (trackMoves) on('pointermove', (event) => record('event', 'pointermove', pointerDetail(event)))

  on('touchstart', (event) =>
    record('event', 'touchstart', touchDetail(event), snapshotSelection()),
  )
  on('touchend', (event) => record('event', 'touchend', touchDetail(event), snapshotSelection()))
  on('touchcancel', (event) => record('event', 'touchcancel', touchDetail(event)))
  if (trackMoves) on('touchmove', (event) => record('event', 'touchmove', touchDetail(event)))

  on('mousedown', (event) => record('event', 'mousedown', mouseDetail(event), snapshotSelection()))
  on('mouseup', (event) => record('event', 'mouseup', mouseDetail(event)))
  on('click', (event) => record('event', 'click', mouseDetail(event), snapshotSelection()))
  on('dblclick', (event) => record('event', 'dblclick', mouseDetail(event), snapshotSelection()))
  on('contextmenu', (event) => record('event', 'contextmenu', mouseDetail(event)))
  if (trackMoves) on('mousemove', (event) => record('event', 'mousemove', mouseDetail(event)))

  on('keydown', (event) => record('event', 'keydown', keyDetail(event), snapshotSelection()))
  on('keyup', (event) => record('event', 'keyup', keyDetail(event)))

  on('beforeinput', (event) =>
    record('event', 'beforeinput', inputDetail(event), snapshotSelection()),
  )
  on('input', (event) => record('event', 'input', inputDetail(event), snapshotSelection()))

  on('compositionstart', (event) => record('event', 'compositionstart', { data: event.data }))
  on('compositionupdate', (event) => record('event', 'compositionupdate', { data: event.data }))
  on('compositionend', (event) =>
    record('event', 'compositionend', { data: event.data }, snapshotSelection()),
  )

  on('focus', () => record('event', 'focus', undefined, snapshotSelection()))
  on('blur', () => record('event', 'blur', undefined, snapshotSelection()))
  on('focusin', (event) => record('event', 'focusin', { target: targetOf(event) }))
  on('focusout', (event) => record('event', 'focusout', { target: targetOf(event) }))
  on('selectstart', () => record('event', 'selectstart', undefined, snapshotSelection()))
  on('scroll', () => record('event', 'scroll', { scrollTop: root.scrollTop }))

  // `selectionchange` only fires on the document, and it is the one signal that
  // survives a software-keyboard spacebar drag, where no touch event reaches
  // the page at all.
  const onSelectionChange = () => record('event', 'selectionchange', undefined, snapshotSelection())
  document.addEventListener('selectionchange', onSelectionChange, { capture: true })
  cleanups.push(() =>
    document.removeEventListener('selectionchange', onSelectionChange, { capture: true }),
  )

  const observer = new MutationObserver((mutations) =>
    record('mutation', 'dom-mutation', mutationDetail(mutations)),
  )
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    characterDataOldValue: true,
  })
  cleanups.push(() => observer.disconnect())

  return () => {
    for (const cleanup of cleanups) cleanup()
  }
}
