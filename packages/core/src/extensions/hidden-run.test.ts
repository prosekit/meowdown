import { describe, expect, it } from 'vitest'

import { findText } from '../testing/find-text.ts'
import { setupFixture, type Fixture } from '../testing/index.ts'

import {
  getCaretTail,
  getHiddenRunAfter,
  getHiddenRunBefore,
  getInnermostPackRangeAt,
  getOutermostPackRangeAt,
  getRestPosition,
  getUnitMarkerRuns,
  isHiddenChar,
  isHiddenRunInterior,
  type HiddenRun,
} from './hidden-run.ts'

function setup(text: string): Fixture {
  const fixture = setupFixture()
  const { n } = fixture
  fixture.set(n.doc(n.paragraph(text)))
  return fixture
}

function runText(fixture: Fixture, run: HiddenRun | undefined): string | undefined {
  return run && fixture.doc.textBetween(run.from, run.to)
}

// `**foo**` sits alone in a paragraph, so its content starts at position 1:
// `*`(1) `*`(2) `f`(3) `o`(4) `o`(5) `*`(6) `*`(7), block end at 8. The
// opening run is [1, 3), the closing run [6, 8).
describe('isHiddenChar', () => {
  it('is true on syntax chars and false on content', () => {
    using fixture = setup('**foo**')
    for (const pos of [1, 2, 6, 7]) expect(isHiddenChar(fixture.state, pos)).toBe(true)
    for (const pos of [3, 4, 5]) expect(isHiddenChar(fixture.state, pos)).toBe(false)
  })

  it('is false on atom source chars', () => {
    using fixture = setup('a[[note]]b')
    const start = findText(fixture.doc, '[[note]]')
    for (let offset = 0; offset < 8; offset++) {
      expect(isHiddenChar(fixture.state, start + offset)).toBe(false)
    }
  })

  it('is false inside a code block', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock('**foo**')))
    expect(isHiddenChar(fixture.state, 1)).toBe(false)
    expect(getHiddenRunBefore(fixture.state, 3)).toBeUndefined()
    expect(getHiddenRunAfter(fixture.state, 1)).toBeUndefined()
  })
})

describe('hidden run walking', () => {
  it('finds the bold marker runs', () => {
    using fixture = setup('**foo**')
    expect(getHiddenRunBefore(fixture.state, 3)).toEqual({ from: 1, to: 3 })
    expect(getHiddenRunAfter(fixture.state, 1)).toEqual({ from: 1, to: 3 })
    expect(getHiddenRunBefore(fixture.state, 8)).toEqual({ from: 6, to: 8 })
    expect(getHiddenRunAfter(fixture.state, 6)).toEqual({ from: 6, to: 8 })
    expect(getHiddenRunBefore(fixture.state, 5)).toBeUndefined()
    expect(getHiddenRunAfter(fixture.state, 8)).toBeUndefined()
  })

  it('folds a link tail into one run', () => {
    using fixture = setup('[docs](https://a.io)')
    expect(runText(fixture, getHiddenRunAfter(fixture.state, 1))).toBe('[')
    const closeFrom = findText(fixture.doc, 'docs') + 4
    expect(runText(fixture, getHiddenRunAfter(fixture.state, closeFrom))).toBe('](https://a.io)')
  })

  it('treats a triple marker as one run', () => {
    using fixture = setup('***x***')
    expect(runText(fixture, getHiddenRunAfter(fixture.state, 1))).toBe('***')
    const posX = findText(fixture.doc, 'x')
    expect(runText(fixture, getHiddenRunAfter(fixture.state, posX + 1))).toBe('***')
  })

  it('merges touching runs of adjacent units', () => {
    using fixture = setup('**a**_b_')
    const posA = findText(fixture.doc, 'a')
    expect(runText(fixture, getHiddenRunAfter(fixture.state, posA + 1))).toBe('**_')
  })
})

describe('isHiddenRunInterior', () => {
  it('marks only strict run interiors', () => {
    using fixture = setup('**foo**')
    const interiors = [2, 7]
    for (let pos = 0; pos <= 8; pos++) {
      expect(isHiddenRunInterior(fixture.state, pos)).toBe(interiors.includes(pos))
    }
  })

  it('gives single-char runs no interior', () => {
    using fixture = setup('*a*')
    for (let pos = 0; pos <= 4; pos++) {
      expect(isHiddenRunInterior(fixture.state, pos)).toBe(false)
    }
  })
})

describe('getInnermostPackRangeAt', () => {
  it('resolves a nested marker to the inner unit', () => {
    using fixture = setup('**a *b* c**')
    const posB = findText(fixture.doc, 'b')
    const pack = getInnermostPackRangeAt(fixture.state, posB - 1)
    expect(runText(fixture, pack)).toBe('*b*')
  })

  it('resolves the outermost marker of a triple run to the outer unit', () => {
    using fixture = setup('***x***')
    const posX = findText(fixture.doc, 'x')
    const pack = getInnermostPackRangeAt(fixture.state, posX + 3)
    expect(runText(fixture, pack)).toBe('***x***')
  })
})

describe('getOutermostPackRangeAt', () => {
  it('resolves a nested unit character to the outer unit', () => {
    using fixture = setup('**a *b* c**')
    const posB = findText(fixture.doc, 'b')
    const pack = getOutermostPackRangeAt(fixture.state, posB)
    expect(runText(fixture, pack)).toBe('**a *b* c**')
  })

  it('resolves the text of a triple unit to the outer unit', () => {
    using fixture = setup('***x***')
    const posX = findText(fixture.doc, 'x')
    const pack = getOutermostPackRangeAt(fixture.state, posX)
    expect(runText(fixture, pack)).toBe('***x***')
  })

  it('is undefined on plain text', () => {
    using fixture = setup('plain **x**')
    expect(getOutermostPackRangeAt(fixture.state, 1)).toBeUndefined()
  })
})

describe('getRestPosition (keyboard)', () => {
  it('continues through a run interior in the travel direction', () => {
    using fixture = setup('**foo**')
    expect(getRestPosition(fixture.state, 1, 2, false)).toBe(3)
    expect(getRestPosition(fixture.state, 3, 2, false)).toBe(1)
    expect(getRestPosition(fixture.state, 8, 7, false)).toBe(6)
    expect(getRestPosition(fixture.state, 6, 7, false)).toBe(8)
  })

  it('keeps rest positions unchanged', () => {
    using fixture = setup('**foo**')
    for (const pos of [1, 3, 4, 5, 6, 8]) {
      expect(getRestPosition(fixture.state, pos, pos, false)).toBe(pos)
    }
  })
})

describe('getRestPosition (pointer)', () => {
  it('snaps run interiors and content edges to the unit outer edge', () => {
    using fixture = setup('**foo**')
    expect(getRestPosition(fixture.state, 2, 2, true)).toBe(1)
    expect(getRestPosition(fixture.state, 7, 7, true)).toBe(8)
    expect(getRestPosition(fixture.state, 3, 3, true)).toBe(1)
    expect(getRestPosition(fixture.state, 6, 6, true)).toBe(8)
    expect(getRestPosition(fixture.state, 1, 1, true)).toBe(1)
    expect(getRestPosition(fixture.state, 8, 8, true)).toBe(8)
  })

  it('snaps a merged run to the nearest end and keeps both ends', () => {
    using fixture = setup('**a**_b_')
    const posA = findText(fixture.doc, 'a')
    const runFrom = posA + 1
    const runTo = runFrom + 3
    expect(getRestPosition(fixture.state, runFrom + 1, runFrom + 1, true)).toBe(runFrom)
    expect(getRestPosition(fixture.state, runFrom + 2, runFrom + 2, true)).toBe(runTo)
    expect(getRestPosition(fixture.state, runFrom, runFrom, true)).toBe(runFrom)
    expect(getRestPosition(fixture.state, runTo, runTo, true)).toBe(runTo)
  })
})

describe('getCaretTail', () => {
  it('points to the typing-affinity side at run edges', () => {
    using fixture = setup('**foo**')
    expect(getCaretTail(fixture.state, 1)).toBe('left')
    expect(getCaretTail(fixture.state, 3)).toBe('right')
    expect(getCaretTail(fixture.state, 6)).toBe('left')
    expect(getCaretTail(fixture.state, 8)).toBe('right')
  })

  it('is undefined in plain text and run interiors', () => {
    using fixture = setup('**foo**')
    expect(getCaretTail(fixture.state, 4)).toBeUndefined()
    expect(getCaretTail(fixture.state, 2)).toBeUndefined()
    expect(getCaretTail(fixture.state, 7)).toBeUndefined()
  })
})

describe('getUnitMarkerRuns', () => {
  it('returns the trailing run first for a bold unit', () => {
    using fixture = setup('**foo**')
    const runs = getUnitMarkerRuns(fixture.state, 7)
    expect(runs).toEqual([
      { from: 6, to: 8 },
      { from: 1, to: 3 },
    ])
  })

  it('returns only the inner unit runs for a nested marker', () => {
    using fixture = setup('**a *b* c**')
    const posB = findText(fixture.doc, 'b')
    const runs = getUnitMarkerRuns(fixture.state, posB - 1)
    expect(runs.map((run) => runText(fixture, run))).toEqual(['*', '*'])
    expect(runs[0].from).toBe(posB + 1)
    expect(runs[1].from).toBe(posB - 1)
  })

  it('returns both triple runs for the outer unit', () => {
    using fixture = setup('***x***')
    const posX = findText(fixture.doc, 'x')
    const runs = getUnitMarkerRuns(fixture.state, posX + 3)
    expect(runs.map((run) => runText(fixture, run))).toEqual(['***', '***'])
  })

  it('returns one run for a fully hidden unit', () => {
    using fixture = setup('x[](https://a.io)y')
    const start = findText(fixture.doc, 'x') + 1
    const runs = getUnitMarkerRuns(fixture.state, start)
    expect(runs.map((run) => runText(fixture, run))).toEqual(['[](https://a.io)'])
  })
})
