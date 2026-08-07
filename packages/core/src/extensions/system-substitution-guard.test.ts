import { isSafari } from '@meowdown/vitest/helpers'
import { describe, expect, it } from 'vitest'

import { findText } from '../testing/find-text.ts'
import { setupFixture } from '../testing/index.ts'

import { isProtectedRange } from './system-substitution-guard.ts'

function dispatchReplacement(target: HTMLElement, init: InputEventInit): InputEvent {
  const event = new InputEvent('beforeinput', { cancelable: true, bubbles: true, ...init })
  target.dispatchEvent(event)
  return event
}

describe('defineSystemSubstitutionGuard', () => {
  it('blocks a replacement that inserts smart punctuation', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('a--b')))
    const event = dispatchReplacement(fixture.dom, {
      inputType: 'insertReplacementText',
      data: '—',
    })
    expect(event.defaultPrevented).toBe(true)
  })

  // WebKit's synthetic InputEvent constructor drops the `dataTransfer` init
  // entry; only trusted events carry one there.
  it.skipIf(isSafari())('blocks smart punctuation delivered through the data transfer', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('say "hi"')))
    const transfer = new DataTransfer()
    transfer.setData('text/plain', '“hi”')
    const event = dispatchReplacement(fixture.dom, {
      inputType: 'insertReplacementText',
      dataTransfer: transfer,
    })
    expect(event.defaultPrevented).toBe(true)
  })

  it('lets a word-level replacement through', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('thier plan')))
    const event = dispatchReplacement(fixture.dom, {
      inputType: 'insertReplacementText',
      data: 'their',
    })
    expect(event.defaultPrevented).toBe(false)
  })

  it('ignores other input types', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('a')))
    const event = dispatchReplacement(fixture.dom, {
      inputType: 'insertText',
      data: '—',
    })
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('isProtectedRange', () => {
  it('protects syntax characters but not visible prose', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('**bold** text')))
    const syntaxStart = findText(fixture.doc, '**')
    const contentStart = findText(fixture.doc, 'bold')
    const proseStart = findText(fixture.doc, 'text')
    expect(isProtectedRange(fixture.state, syntaxStart, syntaxStart + 2)).toBe(true)
    expect(isProtectedRange(fixture.state, contentStart, contentStart + 4)).toBe(false)
    expect(isProtectedRange(fixture.state, proseStart, proseStart + 4)).toBe(false)
  })

  it('protects atom sources', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see [[note]] here')))
    const targetStart = findText(fixture.doc, 'note')
    expect(isProtectedRange(fixture.state, targetStart, targetStart + 4)).toBe(true)
  })

  it('protects inline code and code blocks', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('run `teh` now'), n.codeBlock('teh value')))
    const inlineStart = findText(fixture.doc, 'teh')
    expect(isProtectedRange(fixture.state, inlineStart, inlineStart + 3)).toBe(true)
    const blockStart = findText(fixture.doc, 'teh value')
    expect(isProtectedRange(fixture.state, blockStart, blockStart + 3)).toBe(true)
  })
})
