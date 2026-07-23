import { describe, expect, it } from 'vitest'

import { setupFixture } from '../testing/index.ts'

import { isAtTopLevelBlockEnd, isAtTopLevelBlockStart } from './top-level-block-boundary.ts'

describe('top-level block boundary', () => {
  it('recognizes the start of a top-level textblock', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.heading({ level: 1 }, '<a>a<b>bc')))

    expect(isAtTopLevelBlockStart(fixture.state.selection.$from)).toBe(true)
    expect(isAtTopLevelBlockStart(fixture.state.selection.$to)).toBe(false)
  })

  it('recognizes the end of a top-level textblock', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.heading({ level: 1 }, 'ab<a>c<b>')))

    expect(isAtTopLevelBlockEnd(fixture.state.selection.$to)).toBe(true)
    expect(isAtTopLevelBlockEnd(fixture.state.selection.$from)).toBe(false)
  })

  it('checks every ancestor at the start of a nested textblock', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.blockquote(n.paragraph('<a>one'), n.paragraph('<b>two'))))

    expect(isAtTopLevelBlockStart(fixture.state.selection.$from)).toBe(true)
    expect(isAtTopLevelBlockStart(fixture.state.selection.$to)).toBe(false)
  })

  it('checks every ancestor at the end of a nested textblock', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.blockquote(n.paragraph('one<a>'), n.paragraph('two<b>'))))

    expect(isAtTopLevelBlockEnd(fixture.state.selection.$to)).toBe(true)
    expect(isAtTopLevelBlockEnd(fixture.state.selection.$from)).toBe(false)
  })
})
