import dedent from 'dedent'
import { describe, expect, it } from 'vitest'

import { checkRoundTrip } from './check-roundtrip.ts'

describe('checkRoundTrip', () => {
  it.each([
    'hello world',
    '<div class="x">hi</div>',
    '# Hello #', // an ATX heading with a closing `#` sequence round-trips
    dedent`
      # Hello

      World
    `,
    dedent`
      - a
      - b
    `,
    dedent`
      * a
      * b
    `,
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

    // a list item's soft-wrapped paragraph keeps its indent
    dedent`
      - x

        line one
        line two
    `,
    // nested list, same
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
    // a tab-indented continuation keeps every column the container never took
    '- a\n\t\t-',
    // an info string that opens with the fence character keeps off the fence
    '~~~ ~',
    // an empty item cannot interrupt a paragraph, so the blank line stays
    '1.  ~\n\n-',
    // only a list numbered 1 interrupts a paragraph, so the blank line stays
    '+ ;\n\n2.',
  ])('reports exact for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('exact')
  })

  it.each([
    '- a\n\n- b', // a loose list serializes tight
    '> text\n> - item', // a blockquote gains an empty `>` line before a following list
    '> a\n> - x\n> - y', // same, with a multi-item list inside the blockquote
    '- [ ] todo\neen voorlopig idee', // a lazy continuation gains the canonical item indent
    '- item\nlazy line', // same, on a plain bullet
    '#  Journal', // a double space after the ATX marker collapses to one
    '| a | b |\n| --- | ----------- |\n| c | d |', // delimiter dash counts are layout
    '| a | b |\n| - | - |\n| c | d |', // same, shorter than canonical
    '| a |\n| :---: |\n| b |', // alignment colons survive; only the dash count normalizes
    '| a | b |\n| :--- | ---: |\n| c | d |', // same, for left / right alignment
    '|a|b|\n|---|---|\n|c|d|', // spacing around pipes is layout
    '| a    | b  |\n| ---- | -- |\n| c    | d  |', // pretty-printed cell padding is layout
    'a | b\n--- | ---\nc | d', // outer pipes are layout
    '> a | b\n> --- | ---', // same, inside a blockquote
    '>a', // the space after a blockquote marker is optional
    '>>a', // same, nested
    '> >a', // same, mixed
    '>a\n*', // a lazy continuation regains its blockquote marker
    '```', // an unterminated fence gains its closing fence
    '```\ncode', // same, with content
    '$$', // same, for a math block
    '~~~', // same, for a tilde fence
    '>a\n=', // a lazy setext underline stays text, and gains nothing but the marker space
    '>a\n    code', // a lazy continuation keeps the indentation the marker never took
    ' |\n\t-', // an indented paragraph is not a container: its continuation keeps the tab
    '>a\n\t=', // an indented setext underline stays lazy too
    '>[\n-\t\n$', // same, for a dash run with trailing whitespace
    '>-\n>', // a blockquote marker on the line after an empty item is not item text
    '>\t \n1', // an empty indented code block has no indented spelling
    '<?\n\t', // an unterminated processing instruction runs to the end of the document
    '\n<?\n\n', // same, with the blank lines after it
    ' <!--', // an unterminated comment, same
    '*\t]\n\t\t2', // a tab-indented continuation is re-indented, keeping its own columns
    '| a |\n| --- |\n| b | c |', // a cell past the delimiter row widens the table instead of dropping
  ])('reports normalizing for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('normalizing')
  })

  it.each([])('reports lossy for %j', (markdown: string) => {
    expect(checkRoundTrip(markdown)).toBe('lossy')
  })
})
