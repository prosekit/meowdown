import { describe, expect, it } from 'vitest'

import { setupFixture } from '../testing/index.ts'

import { getSelectedText } from './selected-text.ts'

describe('getSelectedText', () => {
  it('returns bare text for a selection inside one textblock', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('say <a>hello **bold**<b> end')))
    expect(getSelectedText(fixture.state)).toBe('hello **bold**')
  })

  it('returns an empty string for an empty selection', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('say <a><b>hello')))
    expect(getSelectedText(fixture.state)).toBe('')
  })

  it('keeps block markers for a multi-block selection', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.heading({ level: 2 }, '<a>Title'),
        n.list({ kind: 'bullet' }, n.paragraph('one')),
        n.list({ kind: 'bullet' }, n.paragraph('two<b>')),
      ),
    )
    expect(getSelectedText(fixture.state)).toBe('## Title\n\n- one\n- two')
  })

  it('keeps list markers when the selection spans list items partially', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(
        n.list({ kind: 'bullet' }, n.paragraph('first <a>item')),
        n.list({ kind: 'bullet' }, n.paragraph('second<b> item')),
      ),
    )
    expect(getSelectedText(fixture.state)).toBe('- item\n- second')
  })
})
