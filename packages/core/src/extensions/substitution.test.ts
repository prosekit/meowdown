import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

import { defineSubstitution } from './substitution.ts'

function setup() {
  const fixture = setupFixture()
  fixture.editor.use(defineSubstitution())
  return fixture
}

const REPLACEMENTS = [
  { input: '<-', output: '←' },
  { input: '->', output: '→' },
  { input: '(c)', output: '©' },
  { input: '(r)', output: '®' },
  { input: '1/2', output: '½' },
  { input: '+/-', output: '±' },
  { input: '!=', output: '≠' },
  { input: '<<', output: '«' },
  { input: '>>', output: '»' },
  { input: '--', output: '—' },
] as const

describe('substitutions', () => {
  it.each(REPLACEMENTS)(
    'replaces `$input` only after Space is typed',
    async ({ input, output }) => {
      using fixture = setup()
      const { n } = fixture
      fixture.set(n.doc(n.paragraph('before <a>after')))
      fixture.view.focus()

      await userEvent.keyboard(input)
      expect(fixture.doc.textContent).toBe(`before ${input}after`)

      await userEvent.keyboard(' ')
      expect(fixture.doc.textContent).toBe(`before ${output} after`)
    },
  )

  it.each(REPLACEMENTS)(
    'replaces `$input` before Enter splits the paragraph',
    async ({ input, output }) => {
      using fixture = setup()
      const { n } = fixture
      fixture.set(n.doc(n.paragraph('before <a>after')))
      fixture.view.focus()

      await userEvent.keyboard(`${input}{Enter}`)

      const expected = n.doc(n.paragraph(`before ${output}`), n.paragraph('after'))
      expect(fixture.doc.eq(expected)).toBe(true)
    },
  )

  it.each(REPLACEMENTS)(
    'restores `$input` on an immediate Backspace',
    async ({ input, output }) => {
      using fixture = setup()
      const { n } = fixture
      fixture.set(n.doc(n.paragraph('before <a>after')))
      fixture.view.focus()

      await userEvent.keyboard(`${input} `)
      expect(fixture.doc.textContent).toBe(`before ${output} after`)

      await userEvent.keyboard('{Backspace}')
      expect(fixture.doc.textContent).toBe(`before ${input} after`)
    },
  )

  it('uses normal Backspace behavior after more text is typed', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    fixture.view.focus()

    await userEvent.keyboard('(c) x{Backspace}')
    expect(fixture.doc.textContent).toBe('© ')
  })

  it.each([
    { trigger: 'Space', keys: '(c) ', expected: '(c) ' },
    { trigger: 'Enter', keys: '(c){Enter}', expected: '(c)\n' },
  ])('does not replace `(c)` before $trigger inside a code block', async ({ keys, expected }) => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: '' }, '<a>')))
    fixture.view.focus()

    await userEvent.keyboard(keys)
    expect(fixture.doc.textContent).toBe(expected)
  })

  it.each([
    { trigger: 'Space', keys: ' ' },
    { trigger: 'Enter', keys: '{Enter}' },
  ])('does not replace `(c)` before $trigger inside inline code', async ({ keys }) => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('`(c)<a>`')))
    fixture.view.focus()

    await userEvent.keyboard(keys)
    expect(fixture.doc.textContent).toContain('(c)')
    expect(fixture.doc.textContent).not.toContain('©')
  })

  it('uses the matching suffix in `->>`', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    fixture.view.focus()

    await userEvent.keyboard('->> ')
    expect(fixture.doc.textContent).toBe('-» ')
  })

  it.each([
    {
      trigger: 'Space',
      keys: '<!-- x --> ',
      expected: (n: ReturnType<typeof setupFixture>['n']) => n.doc(n.paragraph('<!-- x --> ')),
    },
    {
      trigger: 'Enter',
      keys: '<!-- x -->{Enter}',
      expected: (n: ReturnType<typeof setupFixture>['n']) =>
        n.doc(n.paragraph('<!-- x -->'), n.paragraph()),
    },
  ])('preserves HTML comment delimiters before $trigger', async ({ keys, expected }) => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    fixture.view.focus()

    await userEvent.keyboard(keys)
    expect(fixture.doc.eq(expected(n))).toBe(true)
  })

  it.each([
    {
      trigger: 'Space',
      keys: ' ',
      expected: (n: ReturnType<typeof setupFixture>['n']) => n.doc(n.paragraph('--- ')),
    },
    {
      trigger: 'Enter',
      keys: '{Enter}',
      expected: (n: ReturnType<typeof setupFixture>['n']) =>
        n.doc(n.paragraph('---'), n.paragraph()),
    },
  ])('preserves a thematic-break marker before $trigger', async ({ keys, expected }) => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('---<a>')))
    fixture.view.focus()

    await userEvent.keyboard(keys)
    expect(fixture.doc.eq(expected(n))).toBe(true)
  })

  it('keeps the horizontal-rule input rule working', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    fixture.view.focus()

    await userEvent.keyboard('---')
    expect(fixture.doc.eq(n.doc(n.horizontalRule(), n.paragraph()))).toBe(true)
  })

  it('replaces the final dash pair after nonempty text', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('x<a>')))
    fixture.view.focus()

    await userEvent.keyboard('--- ')
    expect(fixture.doc.textContent).toBe('x-— ')
  })

  it('undoes only the latest replacement', async () => {
    using fixture = setup()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    fixture.view.focus()

    await userEvent.keyboard('<- -> ')
    expect(fixture.doc.textContent).toBe('← → ')

    await userEvent.keyboard('{Backspace}')
    expect(fixture.doc.textContent).toBe('← -> ')
  })
})
