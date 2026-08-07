import { isSafari } from '@meowdown/vitest/helpers'
import { describe, expect, it } from 'vitest'

import { setupFixture } from '../testing/index.ts'

function dispatchReplacement(target: HTMLElement, init: InputEventInit): InputEvent {
  const event = new InputEvent('beforeinput', { cancelable: true, bubbles: true, ...init })
  target.dispatchEvent(event)
  return event
}

describe('defineSystemSubstitutionGuard', () => {
  it('blocks a replacement that inserts an em dash', () => {
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
  it.skipIf(isSafari())('blocks an em dash delivered through the data transfer', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('a--b')))
    const transfer = new DataTransfer()
    transfer.setData('text/plain', '—')
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
