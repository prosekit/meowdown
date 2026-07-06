import dedent from 'dedent'
import { describe, expect, it } from 'vitest'

import { type InlineElement, parseInline } from './inline.ts'
import { LEZER_NODE_IDS } from './node-ids.ts'
import { gfmBlockOnlyParser } from './parser.ts'

/** Every `$...$` slice in the inline element tree, in document order. */
function findMath(text: string): string[] {
  const expressions: string[] = []
  const walk = (elements: readonly InlineElement[]): void => {
    for (const element of elements) {
      if (element.type === LEZER_NODE_IDS.InlineMath) {
        expressions.push(text.slice(element.from, element.to))
      }
      walk(element.children)
    }
  }
  walk(parseInline(text))
  return expressions
}

/** Render an inline element tree into an indented, human-readable string. */
function formatTree(text: string): string {
  const nameById = new Map(Object.entries(LEZER_NODE_IDS).map(([name, id]) => [id, name]))
  const format = (element: InlineElement, depth: number): string => {
    const indent = '  '.repeat(depth)
    const name = nameById.get(element.type) ?? `#${element.type}`
    const slice = JSON.stringify(text.slice(element.from, element.to))
    const head = `${indent}${name} [${element.from}, ${element.to}] ${slice}`
    const children = element.children.map((child) => format(child, depth + 1))
    return [head, ...children].join('\n')
  }
  return parseInline(text)
    .map((element) => format(element, 0))
    .join('\n')
}

describe('math inline parser', () => {
  describe('recognizes', () => {
    const cases: ReadonlyArray<[input: string, expressions: string[]]> = [
      ['$x$', ['$x$']],
      ['$$x$$', ['$$x$$']],
      ['$x+y=z$', ['$x+y=z$']],
      ['a $x$ b', ['$x$']],
      ['a$x$b', ['$x$']],
      ['100$x$', ['$x$']],
      ['$x$ and $y$', ['$x$', '$y$']],
      ['$a b$', ['$a b$']],
      [String.raw`$a \$ b$`, [String.raw`$a \$ b$`]],
      [String.raw`$\frac{1}{2}$`, [String.raw`$\frac{1}{2}$`]],
      ['*em $x$*', ['$x$']],
      ['**strong $x$**', ['$x$']],
      ['$$E=mc^2$$', ['$$E=mc^2$$']],
      ['$x$.', ['$x$']],
      ['($x$)', ['$x$']],
    ]
    for (const [input, expressions] of cases) {
      it(`${JSON.stringify(input)} -> ${expressions.join(' ')}`, () => {
        expect(findMath(input)).toEqual(expressions)
      })
    }
  })

  describe('rejects', () => {
    const cases: readonly string[] = [
      '$',
      '$$',
      '$$$',
      '$ $',
      '$$ $$',
      '$ x$', // space after the opening dollar
      '$x $', // space before the closing dollar
      '$x$5', // digit after the closing dollar
      '$20,000 and $30,000', // currency, the classic false positive
      '$x', // unclosed
      '$$x', // unclosed
      '$x$$', // closing run longer than the opener
      '$$x$', // closing run shorter than the opener
      '$$$x$$$', // opener run longer than two
      '$x$$y$', // `$x` meets the `$$` run and gives up; greedy runs block a restart
      '$a\nb$', // no multiline expressions
      String.raw`\$x$`, // Escape claims `\$`
      String.raw`$a \$ b`, // only an escaped dollar, never closed
      '`$x$`', // InlineCode claims the span
    ]
    for (const input of cases) {
      it(JSON.stringify(input), () => {
        expect(findMath(input)).toEqual([])
      })
    }
  })

  describe('claims the content atomically', () => {
    it('never produces Emphasis inside math', () => {
      const elements = parseInline('$a*b*c$')
      const hasEmphasis = (els: readonly InlineElement[]): boolean =>
        els.some((el) => el.type === LEZER_NODE_IDS.Emphasis || hasEmphasis(el.children))
      expect(hasEmphasis(elements)).toBe(false)
      expect(findMath('$a*b*c$')).toEqual(['$a*b*c$'])
    })

    it('never produces Strikethrough inside math', () => {
      const elements = parseInline('$~~a~~$')
      const hasStrikethrough = (els: readonly InlineElement[]): boolean =>
        els.some((el) => el.type === LEZER_NODE_IDS.Strikethrough || hasStrikethrough(el.children))
      expect(hasStrikethrough(elements)).toBe(false)
    })

    it('does not pair emphasis across a math boundary', () => {
      expect(findMath('*a $b* c$')).toEqual(['$b* c$'])
    })

    it('closes double-dollar math before a trailing dollar run', () => {
      expect(findMath('$$x$$y$$')).toEqual(['$$x$$'])
    })
  })

  it('produces an InlineMath with two InlineMathMark children', () => {
    expect(formatTree('a $x+y$ b')).toMatchInlineSnapshot(`
      "InlineMath [2, 7] "$x+y$"
        InlineMathMark [2, 3] "$"
        InlineMathMark [6, 7] "$""
    `)
  })

  it('produces double-dollar marks covering both dollars', () => {
    expect(formatTree('$$x$$')).toMatchInlineSnapshot(`
      "InlineMath [0, 5] "$$x$$"
        InlineMathMark [0, 2] "$$"
        InlineMathMark [3, 5] "$$""
    `)
  })

  it('is never produced by gfmBlockOnlyParser', () => {
    const markdown = dedent`
      hello $x$

      # heading $y$
    `
    const tree = gfmBlockOnlyParser.parse(markdown)
    let sawMath = false
    tree.iterate({
      enter(node) {
        if (node.type.id === LEZER_NODE_IDS.InlineMath) sawMath = true
      },
    })
    expect(sawMath).toBe(false)
  })
})
