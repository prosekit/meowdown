import { describe, expect, it } from 'vitest'

import { setupFixture } from '../testing/index.ts'

import { isAtTopLevelBlockEnd, isAtTopLevelBlockStart } from './top-level-block-boundary.ts'

describe('top-level block boundary', () => {
  it('recognizes the start of a top-level textblock', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.heading({ level: 1 }, 'abc')))

    expect(isAtTopLevelBlockStart(fixture.doc.resolve(1))).toBe(true)
    expect(isAtTopLevelBlockStart(fixture.doc.resolve(2))).toBe(false)
  })

  it('recognizes the end of a top-level textblock', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.heading({ level: 1 }, 'abc')))

    expect(isAtTopLevelBlockEnd(fixture.doc.resolve(4))).toBe(true)
    expect(isAtTopLevelBlockEnd(fixture.doc.resolve(3))).toBe(false)
  })

  it('checks every ancestor at the start of a nested textblock', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.blockquote(n.paragraph('one'), n.paragraph('two'))))

    expect(isAtTopLevelBlockStart(fixture.doc.resolve(2))).toBe(true)
    expect(isAtTopLevelBlockStart(fixture.doc.resolve(7))).toBe(false)
  })

  it('checks every ancestor at the end of a nested textblock', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.blockquote(n.paragraph('one'), n.paragraph('two'))))

    expect(isAtTopLevelBlockEnd(fixture.doc.resolve(10))).toBe(true)
    expect(isAtTopLevelBlockEnd(fixture.doc.resolve(5))).toBe(false)
  })
})
