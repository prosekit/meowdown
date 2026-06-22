import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture } from '../testing/index.ts'

describe('input rule', () => {
  it('wraps a block into a circle checkbox task on `+ `', async () => {
    using fixture = setupFixture()
    fixture.set(fixture.n.doc(fixture.n.paragraph('<a>todo')))
    fixture.view.focus()
    await userEvent.keyboard('+ ')
    expect(docToMarkdown(fixture.doc)).toBe('+ [ ] todo\n')
  })

  it('wraps a block into a plain bullet on `- ` (not a checkbox task)', async () => {
    using fixture = setupFixture()
    fixture.set(fixture.n.doc(fixture.n.paragraph('<a>todo')))
    fixture.view.focus()
    await userEvent.keyboard('- ')
    expect(docToMarkdown(fixture.doc)).toBe('- todo\n')
  })
})

describe('commands', () => {
  it('wrapInCircleTask makes a circle checkbox task', () => {
    using fixture = setupFixture()
    fixture.set(fixture.n.doc(fixture.n.paragraph('todo<a>')))
    fixture.editor.commands.wrapInCircleTask()
    expect(docToMarkdown(fixture.doc)).toBe('+ [ ] todo\n')
  })

  it('wrapInSquareTask makes a square checkbox task', () => {
    using fixture = setupFixture()
    fixture.set(fixture.n.doc(fixture.n.paragraph('todo<a>')))
    fixture.editor.commands.wrapInSquareTask()
    expect(docToMarkdown(fixture.doc)).toBe('- [ ] todo\n')
  })

  it('converts a square checkbox task to a circle checkbox task, keeping checked', () => {
    using fixture = setupFixture()
    fixture.set(
      fixture.n.doc(
        fixture.n.list({ kind: 'task', checked: true }, fixture.n.paragraph('done<a>')),
      ),
    )
    fixture.editor.commands.wrapInCircleTask()
    expect(docToMarkdown(fixture.doc)).toBe('+ [x] done\n')
  })

  it('converts a circle checkbox task back to a square checkbox task, keeping checked', () => {
    using fixture = setupFixture()
    fixture.set(
      fixture.n.doc(
        fixture.n.list(
          { kind: 'task', marker: '+', checked: true },
          fixture.n.paragraph('done<a>'),
        ),
      ),
    )
    fixture.editor.commands.wrapInSquareTask()
    expect(docToMarkdown(fixture.doc)).toBe('- [x] done\n')
  })
})
