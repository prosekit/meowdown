import dedent from 'dedent'
import { describe, expect, it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

const EXACT_CASES: string[] = [
  // a plain paragraph
  'hello world',

  // raw HTML is literal text
  '<div class="x">hi</div>',

  // an ATX heading with a closing `#` sequence round-trips
  '# Hello #',

  // blocks separated by a blank line
  dedent`
    # Hello

    World
  `,

  // a tight bullet list, with either marker
  dedent`
    - a
    - b
  `,
  dedent`
    * a
    * b
  `,

  // a table keeps its empty cells
  dedent`
    |  |  |  |
    | --- | --- | --- |
    |  |  |  |
  `,
  dedent`
    | a |  | c |
    | --- | --- | --- |
    |  | b |  |
  `,

  // setext heading keeps its text and underline length
  dedent`
    Hello
    =====
  `,

  // a list item's soft-wrapped paragraph keeps its indent, in a nested list too
  dedent`
    - x

      line one
      line two
  `,
  dedent`
    - a
      - x

        line one
        line two
  `,

  // an indented code block keeps its indented form
  '    indented',

  // a tilde fence keeps its fence character
  '~~~\ntilde\n~~~',

  // a dollar math block keeps its dollar fences
  '$$\nE=mc^2\n$$',

  // inline math is plain text to the converter
  'a $x$ b $$y$$ c',

  // extra blank lines round-trip as empty paragraphs
  'a\n\n\nb',

  // trailing spaces on a line that carries text are part of that text
  'trailing spaces   ',

  // an empty task keeps the space that tells it apart from a `[ ]` bullet
  '- [ ] Asdf\n- [ ]\n- [ ] ',

  // a blockquote's continuation line keeps its own indentation
  '> a\n>   b',

  // a lazy continuation that reads as a setext underline stays lazy
  '- a\n=',
  '- a\n--',

  // a task's continuation lines align with the item, not with the checkbox
  '- [ ] a\n      b',

  // a nested blockquote's continuation keeps the indent inside the quote
  '- > a\n  >   b',

  // a setext heading inside a blockquote keeps its underline on its own line
  '> a\n> -',

  // a link reference's label spans the break, and holds the `>` marker inside it
  '> [\n> $]:*',

  // a lazy continuation that would open a blockquote under the item's indent
  '*    a\n\t>',

  // an empty item cannot interrupt a paragraph, so the blank line stays
  '1.  ~\n\n-',

  // only a list numbered 1 interrupts a paragraph, so the blank line stays
  '+ ;\n\n2.',

  // a no-break space is heading text, not the gap around a closing `#` run
  '# #\u{A0}',
]

const NORMALIZING_CASES: string[] = [
  // a loose list serializes tight
  '- a\n\n- b',

  // a blockquote gains an empty `>` line before a following list
  '> text\n> - item',
  '> a\n> - x\n> - y',

  // a lazy continuation gains the canonical item indent
  '- [ ] todo\neen voorlopig idee',
  '- item\nlazy line',

  // a double space after the ATX marker collapses to one
  '#  Journal',

  // delimiter dash counts are layout
  '| a | b |\n| --- | ----------- |\n| c | d |',
  '| a | b |\n| - | - |\n| c | d |',

  // alignment colons survive; only the dash count normalizes
  '| a |\n| :---: |\n| b |',
  '| a | b |\n| :--- | ---: |\n| c | d |',

  // spacing around pipes and pretty-printed cell padding are layout
  '|a|b|\n|---|---|\n|c|d|',
  '| a    | b  |\n| ---- | -- |\n| c    | d  |',

  // outer pipes are layout, inside a blockquote too
  'a | b\n--- | ---\nc | d',
  '> a | b\n> --- | ---',

  // the space after a blockquote marker is optional, nested and mixed too
  '>a',
  '>>a',
  '> >a',

  // a lazy continuation regains its blockquote marker
  '>a\n*',

  // an unterminated fence gains its closing fence, `$$` and `~~~` too
  '```',
  '```\ncode',
  '$$',
  '~~~',

  // a closing fence may be longer than the one it closes
  '```\ncode\n````',
  '~~~\ncode\n~~~~~',
  '```js\ncode\n````',
  '```\n````',
  '> ```\n> ````',
  '- ```\n  ````',

  // a lazy setext underline stays text, and gains nothing but the marker space
  '>a\n=',

  // a lazy continuation keeps the indentation the marker never took
  '>a\n    code',

  // an indented paragraph is not a container: its continuation keeps the tab
  ' |\n\t-',

  // an indented setext underline stays lazy too, a dash run with trailing
  // whitespace included
  '>a\n\t=',
  '>[\n-\t\n$',

  // a blockquote marker on the line after an empty item is not item text
  '>-\n>',

  // an empty indented code block has no indented spelling
  '>\t \n1',

  // an unterminated processing instruction runs to the end of the document,
  // the blank lines after it included; an unterminated comment the same
  '<?\n\t',
  '\n<?\n\n',
  ' <!--',

  // an info string that opens with the fence character keeps off the fence
  '~~~ ~',

  // a tab-indented continuation is re-indented, keeping its own columns, even
  // when the line would read as a setext underline unindented
  '*\t]\n\t\t2',
  '- a\n\t\t-',

  // indentation cannot spell a code block that follows a list, nor one that
  // opens with a blank line
  ' 33)\n\t1',
  '*\t\t\n\t\t[',

  // a cell past the delimiter row widens the table instead of dropping
  '| a |\n| --- |\n| b | c |',

  // a tab after a blockquote marker is indentation, not the marker's space
  '>=\n>\t\t>',

  // an unterminated block ends with its last content line, marker or not
  '><?\n\t>',

  // a lazy continuation inside a blockquote keeps every column it has
  '-\t>$\n\t\t2',

  // a fence line with trailing text closes nothing, so the fence stays narrow
  '```\n```-',

  // lezer leaves code after a tab-indented quote marker uncovered; keep it
  '>\t \n\t>2',

  // an HTML block has no lazy continuation, so its lines keep the full prefix
  '><?\n>\tb',

  // a block opener the dedent bared goes back out behind the containers'
  // columns; so does a tab the dedent would otherwise eat
  '>\t*\ta\n\t<?',
  '>\t*\ta\n\t\tx',

  // a bare bullet opens an item even empty, so it cannot keep the prefix
  '>\t*\t\\\n\t+',

  // a git conflict marker run is a blockquote nest, so `>>>>>>> b` is
  // rewritten as `> > > > > > > b`: same document, different bytes
  '<<<<<<< a\nx\n=======\ny\n>>>>>>> b',

  // a lone dash cell reads as a delimiter row until the pretty-printer pads it
  '-|\n-|\n`|-',

  // a pipe-less row's text keeps markers the piped spelling shows as cell text
  '-|\n-|\n\t>#',
  '#|\n-|\n\t1.\t!',

  // a lone `:-` data cell is a delimiter lookalike only when piped
  '|#\n-|\n:-',

  // a cell keeps a fence run whose width the bare line would shorten
  '~|\n-|\n\t````',

  // an empty task's lazy line goes back out under the quote's own marker
  '> - [ ] \nb',

  // a task with an HTML comment in its lazy line
  '- [x] <!--\nABC\n-->',

  // a task with an HTML element
  '- [x] <div></div>\nABC',
]

const LOSSY_CASES: string[] = [
  // a lazy line beside a fence or table lookalike is re-quoted into the quote
  '>2\n```|`\n|-|',
  '>~\n>*|\n-|',
  '>$\n~|\n>|-|',
  '>\\\n|-\n>|-|',

  // a conflict marker run respaces into a blockquote nest that swallows the
  // second marker line
  '>>>>>>>,\n>>>>>>> \t>',

  // an empty ordered item keeps blank lines; the re-indented `~` changes blocks
  '  1.\n\n\n\t~',

  // CommonMark spec example 312: escalating one-space indents flatten
  '- a\n - b\n  - c\n   - d\n    - e',
]

describe('checkRoundTrip', () => {
  it.each(EXACT_CASES)('reports exact for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('exact')
  })

  it.each(NORMALIZING_CASES)('reports normalizing for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('normalizing')
  })

  it.each(LOSSY_CASES)('reports lossy for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('lossy')
  })
})
