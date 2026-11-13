import { noop, returnFalse, returnTrue } from '@ocavue/utils'
import { describe, expect, it } from 'vitest'

import { transitionHover, type HoverPhase } from './mark-hover.ts'

interface Mark {
  readonly payload: string | undefined
}

type Phase = HoverPhase<string, Mark>

const alpha = { payload: 'Alpha' }
const beta = { payload: 'Beta' }
const unresolved: Mark = { payload: undefined }

const idle: Phase = { kind: 'idle' }

function pending(element: Mark): Phase {
  return { kind: 'pending', element }
}

function active(element: { readonly payload: string }): Phase {
  return { kind: 'active', hit: { payload: element.payload, element } }
}

function leaving(element: { readonly payload: string }): Phase {
  return { kind: 'leaving', hit: { payload: element.payload, element } }
}

function dismissed(element: Mark): Phase {
  return { kind: 'dismissed', element }
}

function over(phase: Phase, element: Mark) {
  return transitionHover(phase, { type: 'over', element, resolve: () => element.payload })
}

function out(phase: Phase) {
  return transitionHover(phase, { type: 'out', isWithin: returnFalse })
}

function elapseOpen(phase: Phase) {
  return transitionHover(phase, { type: 'open-elapsed', resolve: (element) => element.payload })
}

function elapseClose(phase: Phase, canLeave = true) {
  return transitionHover(phase, { type: 'close-elapsed', canLeave })
}

function update(phase: Phase, payload: string | undefined, isSamePayload = true) {
  return transitionHover(phase, {
    type: 'update',
    isAttached: returnTrue,
    resolve: () => payload,
    isSamePayload: () => isSamePayload,
  })
}

describe('over', () => {
  it('starts the open delay on a cold hover', () => {
    expect(over(idle, alpha)).toEqual(pending(alpha))
  })

  it('ignores an element without a payload', () => {
    expect(over(idle, unresolved)).toBeUndefined()
  })

  it('ignores moves within the pending mark', () => {
    expect(over(pending(alpha), alpha)).toBeUndefined()
  })

  it('restarts the open delay on another mark', () => {
    expect(over(pending(alpha), beta)).toEqual(pending(beta))
  })

  it('switches from an entered mark without a delay', () => {
    expect(over(active(alpha), beta)).toEqual(active(beta))
  })

  it('switches from a leaving mark without a delay', () => {
    expect(over(leaving(alpha), beta)).toEqual(active(beta))
  })

  it('returns during the leave grace without a delay or an event', () => {
    expect(over(leaving(alpha), alpha)).toEqual(active(alpha))
  })

  it('keeps a dismissed mark silent', () => {
    expect(over(dismissed(alpha), alpha)).toBeUndefined()
  })

  it('starts the open delay on another mark after a dismiss', () => {
    expect(over(dismissed(alpha), beta)).toEqual(pending(beta))
  })
})

describe('out', () => {
  it('cancels a pending enter', () => {
    expect(out(pending(alpha))).toEqual(idle)
  })

  it('starts the leave grace on an entered mark', () => {
    expect(out(active(alpha))).toEqual(leaving(alpha))
  })

  it('ignores moves onto a descendant of the mark', () => {
    const step = transitionHover(active(alpha), { type: 'out', isWithin: returnTrue })
    expect(step).toBeUndefined()
  })

  it('ignores an out without a tracked mark', () => {
    expect(out(idle)).toBeUndefined()
    expect(out(leaving(alpha))).toBeUndefined()
  })
})

describe('timers', () => {
  it('enters when the open delay elapses', () => {
    expect(elapseOpen(pending(alpha))).toEqual(active(alpha))
  })

  it('drops a pending mark that is gone when the open delay elapses', () => {
    expect(elapseOpen(pending(unresolved))).toEqual(idle)
  })

  it('leaves when the close delay elapses', () => {
    expect(elapseClose(leaving(alpha))).toEqual(idle)
  })

  it('restarts the close delay while the pointer is on the popup', () => {
    expect(elapseClose(leaving(alpha), false)).toEqual(leaving(alpha))
  })
})

describe('update', () => {
  it('ignores an edit that keeps the payload', () => {
    expect(update(leaving(alpha), 'Alpha v2')).toBeUndefined()
  })

  it('leaves when the payload changes', () => {
    expect(update(active(alpha), 'Gamma', false)).toEqual(idle)
  })

  it('leaves when the mark is gone', () => {
    expect(update(active(alpha), undefined)).toEqual(idle)
  })

  it('forgets a dismissed mark once it is detached', () => {
    const step = transitionHover(dismissed(alpha), {
      type: 'update',
      isAttached: returnFalse,
      resolve: noop,
      isSamePayload: returnTrue,
    })
    expect(step).toEqual(idle)
  })
})

describe('dismiss', () => {
  it('silences a pending mark', () => {
    expect(transitionHover(pending(alpha), { type: 'dismiss' })).toEqual(dismissed(alpha))
  })

  it('leaves an entered mark and silences it', () => {
    expect(transitionHover(active(alpha), { type: 'dismiss' })).toEqual(dismissed(alpha))
  })

  it('leaves a leaving mark at once', () => {
    expect(transitionHover(leaving(alpha), { type: 'dismiss' })).toEqual(idle)
  })

  it('forgets a dismissed mark once the pointer leaves it', () => {
    expect(out(dismissed(alpha))).toEqual(idle)
  })
})

describe('tap and reset', () => {
  it('enters a dismissed mark from a tap without a delay', () => {
    const step = transitionHover(dismissed(alpha), {
      type: 'tap',
      element: alpha,
      resolve: () => alpha.payload,
    })
    expect(step).toEqual(active(alpha))
  })

  it('leaves at once on a reset', () => {
    expect(transitionHover(leaving(alpha), { type: 'reset' })).toEqual(idle)
  })
})
