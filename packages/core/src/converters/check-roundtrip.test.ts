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
  ])('reports exact for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('exact')
  })

  it.each([
    '- a\n\n- b', // a loose list serializes tight
    '- [ ] Asdf\n- [ ]\n- [ ] ', // a trailing space on an empty task is normalized away
    'trailing spaces   ', // trailing whitespace is insignificant
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
  ])('reports normalizing for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('normalizing')
  })

  it.each([
    '| a |\n| --- |\n| b | c |', // a cell beyond the delimiter's column count is dropped
  ])('reports lossy for %j', (markdown) => {
    expect(checkRoundTrip(markdown)).toBe('lossy')
  })
})
