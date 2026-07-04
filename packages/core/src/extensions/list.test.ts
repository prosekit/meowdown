import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture } from '../testing/index.ts'

describe('input rule', () => {
  it('wraps a block into a circle checkbox task on `+ `', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>todo')))
    fixture.view.focus()
    await userEvent.keyboard('+ ')
    expect(docToMarkdown(fixture.doc)).toBe('+ [ ] todo\n')
  })

  it('wraps a block into a plain bullet on `- ` (not a checkbox task)', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>todo')))
    fixture.view.focus()
    await userEvent.keyboard('- ')
    expect(docToMarkdown(fixture.doc)).toBe('- todo\n')
  })
})

describe('commands', () => {
  it('wrapInCircleTask makes a circle checkbox task', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('todo<a>')))
    fixture.editor.commands.wrapInCircleTask()
    expect(docToMarkdown(fixture.doc)).toBe('+ [ ] todo\n')
  })

  it('wrapInSquareTask makes a square checkbox task', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('todo<a>')))
    fixture.editor.commands.wrapInSquareTask()
    expect(docToMarkdown(fixture.doc)).toBe('- [ ] todo\n')
  })

  it('converts a square checkbox task to a circle checkbox task, keeping checked', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'task', checked: true }, n.paragraph('done<a>'))))
    fixture.editor.commands.wrapInCircleTask()
    expect(docToMarkdown(fixture.doc)).toBe('+ [x] done\n')
  })

  it('converts a circle checkbox task back to a square checkbox task, keeping checked', () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'task', marker: '+', checked: true }, n.paragraph('done<a>'))))
    fixture.editor.commands.wrapInSquareTask()
    expect(docToMarkdown(fixture.doc)).toBe('- [x] done\n')
  })
})

describe('keymap', () => {
  const pressModEnter = () => userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}')
  const pressModShiftEnter = () =>
    userEvent.keyboard('{ControlOrMeta>}{Shift>}{Enter}{/Shift}{/ControlOrMeta}')

  it('Mod-Enter cycles a square checkbox task: unchecked -> checked -> bullet', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('todo<a>')))
    fixture.view.focus()

    await pressModEnter()
    expect(docToMarkdown(fixture.doc)).toBe('- [ ] todo\n')
    await pressModEnter()
    expect(docToMarkdown(fixture.doc)).toBe('- [x] todo\n')
    await pressModEnter()
    expect(docToMarkdown(fixture.doc)).toBe('- todo\n')
  })

  it('Mod-Shift-Enter cycles a circle checkbox task: unchecked -> checked -> bullet', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('todo<a>')))
    fixture.view.focus()

    await pressModShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('+ [ ] todo\n')
    await pressModShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('+ [x] todo\n')
    await pressModShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('- todo\n')
  })

  it('Mod-Enter converts a circle checkbox task into a square checkbox task', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(
      n.doc(n.list({ kind: 'task', marker: '+', checked: false }, n.paragraph('todo<a>'))),
    )
    fixture.view.focus()

    await pressModEnter()
    expect(docToMarkdown(fixture.doc)).toBe('- [ ] todo\n')
  })

  it('Mod-Shift-Enter converts a square checkbox task into a circle checkbox task', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'task', checked: false }, n.paragraph('todo<a>'))))
    fixture.view.focus()

    await pressModShiftEnter()
    expect(docToMarkdown(fixture.doc)).toBe('+ [ ] todo\n')
  })

  // The physical digit keys, so the shifted character ('&', '*', '(' on a US
  // layout) exercises prosemirror-keymap's keyCode fallback.
  const pressModShiftDigit = (digit: 7 | 8 | 9) =>
    userEvent.keyboard(`{ControlOrMeta>}{Shift>}[Digit${digit}]{/Shift}{/ControlOrMeta}`)

  it('Mod-Shift-8 wraps a paragraph into a bullet and unwraps it again', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('todo<a>')))
    fixture.view.focus()

    await pressModShiftDigit(8)
    expect(docToMarkdown(fixture.doc)).toBe('- todo\n')
    await pressModShiftDigit(8)
    expect(docToMarkdown(fixture.doc)).toBe('todo\n')
  })

  it('Mod-Shift-7 wraps a paragraph into an ordered list and unwraps it again', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('todo<a>')))
    fixture.view.focus()

    await pressModShiftDigit(7)
    expect(docToMarkdown(fixture.doc)).toBe('1. todo\n')
    await pressModShiftDigit(7)
    expect(docToMarkdown(fixture.doc)).toBe('todo\n')
  })

  it('Mod-Shift-9 wraps a paragraph into a square checkbox task and unwraps it again', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('todo<a>')))
    fixture.view.focus()

    await pressModShiftDigit(9)
    expect(docToMarkdown(fixture.doc)).toBe('- [ ] todo\n')
    await pressModShiftDigit(9)
    expect(docToMarkdown(fixture.doc)).toBe('todo\n')
  })

  it('Mod-Shift-7 converts a bullet into an ordered list in place', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.list({ kind: 'bullet' }, n.paragraph('todo<a>'))))
    fixture.view.focus()

    await pressModShiftDigit(7)
    expect(docToMarkdown(fixture.doc)).toBe('1. todo\n')
  })
})
