import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

function setupEditor() {
  const fixture = setupFixture()
  fixture.view.focus()
  return fixture
}

async function pressModEnter(): Promise<void> {
  await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}')
}

async function pressShiftEnter(): Promise<void> {
  await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
}

describe('Mod-Enter at the end of a code block', () => {
  it('adds a paragraph below the last block and moves the caret into it', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: 'js' }, 'code<a>')))
    await pressModEnter()
    await userEvent.keyboard('X')
    expect(fixture.doc.eq(n.doc(n.codeBlock({ language: 'js' }, 'code'), n.paragraph('X')))).toBe(
      true,
    )
  })

  it('adds a paragraph between two code blocks', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock('one<a>'), n.codeBlock('two')))
    await pressModEnter()
    await userEvent.keyboard('X')
    expect(fixture.doc.eq(n.doc(n.codeBlock('one'), n.paragraph('X'), n.codeBlock('two')))).toBe(
      true,
    )
  })

  it('reuses an empty paragraph that already sits below', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock('code<a>'), n.paragraph(), n.paragraph('after')))
    await pressModEnter()
    await userEvent.keyboard('X')
    expect(fixture.doc.eq(n.doc(n.codeBlock('code'), n.paragraph('X'), n.paragraph('after')))).toBe(
      true,
    )
  })

  it('adds a paragraph above a non-empty paragraph', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock('code<a>'), n.paragraph('after')))
    await pressModEnter()
    await userEvent.keyboard('X')
    expect(fixture.doc.eq(n.doc(n.codeBlock('code'), n.paragraph('X'), n.paragraph('after')))).toBe(
      true,
    )
  })

  it('stays inside the blockquote that holds the code block', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.blockquote(n.codeBlock('code<a>'))))
    await pressModEnter()
    await userEvent.keyboard('X')
    expect(fixture.doc.eq(n.doc(n.blockquote(n.codeBlock('code'), n.paragraph('X'))))).toBe(true)
  })

  it('keeps the trailing newlines of the code', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock('code\n<a>')))
    await pressModEnter()
    expect(fixture.doc.eq(n.doc(n.codeBlock('code\n'), n.paragraph()))).toBe(true)
  })
})

describe('Shift-Enter at the end of a code block', () => {
  it('adds a paragraph below the last block and moves the caret into it', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: 'js' }, 'code<a>')))
    await pressShiftEnter()
    await userEvent.keyboard('X')
    expect(fixture.doc.eq(n.doc(n.codeBlock({ language: 'js' }, 'code'), n.paragraph('X')))).toBe(
      true,
    )
  })

  it('reuses an empty paragraph that already sits below', async () => {
    using fixture = setupEditor()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock('code<a>'), n.paragraph()))
    await pressShiftEnter()
    await userEvent.keyboard('X')
    expect(fixture.doc.eq(n.doc(n.codeBlock('code'), n.paragraph('X')))).toBe(true)
  })
})
