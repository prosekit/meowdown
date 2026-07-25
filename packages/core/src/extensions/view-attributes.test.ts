import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

import { defineViewAttributes } from './view-attributes.ts'

const pmRoot = page.locate('.ProseMirror')

describe('defineViewAttributes', () => {
  it('gives the editable root the content class from the first paint', async () => {
    using fixture = setupFixture()
    void fixture
    await expect.element(pmRoot).toHaveClass('meowdown-content')
  })

  it('applies the gutter padding the content class carries', () => {
    using fixture = setupFixture()
    expect(getComputedStyle(fixture.dom).paddingLeft).not.toBe('0px')
  })

  it('adds a host class alongside the built-in ones', async () => {
    using fixture = setupFixture()
    fixture.editor.use(defineViewAttributes({ class: 'host-class' }))

    await expect.element(pmRoot).toHaveClass('ProseMirror')
    await expect.element(pmRoot).toHaveClass('meowdown-content')
    await expect.element(pmRoot).toHaveClass('host-class')
  })

  it('drops the host class when the extension is removed', async () => {
    using fixture = setupFixture()
    const dispose = fixture.editor.use(defineViewAttributes({ class: 'host-class' }))
    await expect.element(pmRoot).toHaveClass('host-class')

    dispose()

    await expect.element(pmRoot).not.toHaveClass('host-class')
    await expect.element(pmRoot).toHaveClass('meowdown-content')
  })
})
