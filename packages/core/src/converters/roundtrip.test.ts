import dedent from 'dedent'
import { describe, expect, it } from 'vitest'

import { markdownToDoc } from './md-to-pm.ts'
import { docToMarkdown } from './pm-to-md.ts'

function roundtrip(markdown: string): string {
  return docToMarkdown(markdownToDoc(markdown))
}

/**
 * Byte-identity guard: `docToMarkdown(markdownToDoc(md))` must reproduce the
 * input exactly, modulo the single trailing newline `docToMarkdown` always
 * appends. Each case here is markdown that editor consumers (which treat
 * markdown files as the source of truth) expect to survive a load/save cycle
 * without a spurious diff.
 */
describe('markdown round-trip is byte-identical', () => {
  const cases = [
    // Task lists (GFM `Task` / `TaskMarker`)
    '- [ ] todo',
    '- [x] done',
    dedent`
      - [ ] todo
      - [x] done
      - [ ] another
    `,
    dedent`
      - [x] done
      - plain item
      - [ ] todo
    `,
    dedent`
      - [ ] parent
        - [x] child
    `,
    '- [ ]  double-spaced text',
    // Task marker inside an ordered list has no `task` list kind to map to;
    // the marker survives as literal paragraph text instead.
    '1. [x] done',
    // Tight lists stay tight
    dedent`
      - a
      - b
    `,
    dedent`
      - parent
        - child
    `,
    dedent`
      1. one
      1. two
    `,
    // Empty list items keep their marker; the line is not dropped
    '-',
    dedent`
      - a
      -
      - b
    `,
    // A genuinely loose item (two blocks) keeps its blank line
    dedent`
      - a

        second paragraph
    `,
    // Tags are plain text to the converters
    'hello #meow',
    // `#tag` at line start is NOT a heading (no space after `#`)
    '#meow starts the line',
    '- [ ] #todo item',
    '> quoted #tag',
    // Wikilinks are plain text to the converters
    'see [[note]]',
    '[[note]] starts the line',
    '- [ ] [[note]] item',
    '> [[note]] quoted',
    '[[note with spaces]] and #tag',
    // Autolinks are plain text to the converters (marks decorate, not rewrite)
    'visit https://example.com now',
    'see www.example.com here',
    'mail me@example.com ok',
    'a <https://example.com> b',
    'end https://example.com.',
    // Bare domains autolink too, but stay plain text to the converters
    'see google.com here',
    'paths sub.domain.net/a/b?x=1 end',
    'not a link README.md here',
    '![cat](https://example.com/cat.png)',
    'a ![one](https://example.com/1.png) b ![two](https://example.com/2.png) c',
    '![](https://www.youtube.com/watch?v=dQw4w9WgXcQ)',
    '![](https://twitter.com/jack/status/20)',
    'text before ![](https://youtu.be/dQw4w9WgXcQ) and after',
    // Tables, including empty and partially-empty cells. The serializer writes
    // empty cells unpadded (`|  |`), so these stay unaligned to match its bytes.
    dedent`
      | a | b |
      | --- | --- |
      | 1 | 2 |
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
  ]

  for (const markdown of cases) {
    it(`preserves ${JSON.stringify(markdown)}`, () => {
      expect(roundtrip(markdown)).toBe(`${markdown}\n`)
    })
  }
})

describe('markdown round-trip normalizations', () => {
  it('normalizes loose single-paragraph lists to tight', () => {
    // Tightness is not stored in the document, so a loose list whose items
    // could be tight comes back tight. This is the one list normalization
    // docToMarkdown performs.
    expect(roundtrip('- a\n\n- b')).toBe('- a\n- b\n')
  })

  it('normalizes an uppercase task marker to lowercase', () => {
    expect(roundtrip('- [X] done')).toBe('- [x] done\n')
  })

  it('trims an empty list item to a bare marker', () => {
    expect(roundtrip('- ')).toBe('-\n')
    expect(roundtrip('- a\n- \n- b')).toBe('- a\n-\n- b\n')
  })
})

// Edge cases. `it` asserts a lossless load/save; `it.fails` pins inputs that do
// NOT survive a round-trip, keeping the suite green while documenting behavior.

describe('round-trip edge cases: text', () => {
  it('preserves soft line breaks within a paragraph', () => {
    expect(roundtrip('a\nb\nc')).toBe('a\nb\nc\n')
  })

  it('keeps a blank line between two paragraphs', () => {
    expect(roundtrip('line1\n\nline2')).toBe('line1\n\nline2\n')
  })

  it('preserves a tab inside text', () => {
    expect(roundtrip('tab\tinside')).toBe('tab\tinside\n')
  })

  it('preserves accented characters', () => {
    expect(roundtrip('café résumé')).toBe('café résumé\n')
  })

  it('preserves emoji', () => {
    expect(roundtrip('emoji 🎉 test')).toBe('emoji 🎉 test\n')
  })

  it('preserves CJK text', () => {
    expect(roundtrip('CJK 中文 テスト')).toBe('CJK 中文 テスト\n')
  })

  it('preserves runs of multiple spaces', () => {
    expect(roundtrip('a  b  spaces')).toBe('a  b  spaces\n')
  })

  it('preserves a literal backslash', () => {
    expect(roundtrip(String.raw`backslash \ here`)).toBe('backslash \\ here\n')
  })

  it('preserves angle brackets and ampersands', () => {
    expect(roundtrip('amp & lt < gt >')).toBe('amp & lt < gt >\n')
  })

  it.fails('does not keep trailing spaces on a line', () => {
    expect(roundtrip('trailing spaces   ')).toBe('trailing spaces   \n')
  })
})

describe('round-trip edge cases: inline stays literal text', () => {
  it('keeps bold markers as text', () => {
    expect(roundtrip('**bold**')).toBe('**bold**\n')
  })

  it('keeps italic markers as text', () => {
    expect(roundtrip('*italic*')).toBe('*italic*\n')
  })

  it('keeps strikethrough markers as text', () => {
    expect(roundtrip('~~strike~~')).toBe('~~strike~~\n')
  })

  it('keeps inline code as text', () => {
    expect(roundtrip('`inline`')).toBe('`inline`\n')
  })

  it('keeps a link as text', () => {
    expect(roundtrip('[link](url)')).toBe('[link](url)\n')
  })

  it('keeps an image as text', () => {
    expect(roundtrip('![img](src)')).toBe('![img](src)\n')
  })

  it('keeps an angle autolink as text', () => {
    expect(roundtrip('<https://auto.com>')).toBe('<https://auto.com>\n')
  })

  it('keeps an aliased wikilink as text', () => {
    expect(roundtrip('[[note|alias]]')).toBe('[[note|alias]]\n')
  })

  it('keeps a hashtag as text', () => {
    expect(roundtrip('#hashtag')).toBe('#hashtag\n')
  })

  it('keeps escaped emphasis as text', () => {
    expect(roundtrip(String.raw`foo \*esc\*`)).toBe('foo \\*esc\\*\n')
  })

  it.fails('drops a raw HTML block', () => {
    expect(roundtrip('<div>html</div>')).toBe('<div>html</div>\n')
  })

  it.fails('drops an HTML comment', () => {
    expect(roundtrip('<!-- comment -->')).toBe('<!-- comment -->\n')
  })
})

describe('round-trip edge cases: headings', () => {
  it('preserves a level-6 heading', () => {
    expect(roundtrip('###### H6')).toBe('###### H6\n')
  })

  it('treats seven hashes as text', () => {
    expect(roundtrip('####### seven')).toBe('####### seven\n')
  })

  it('treats a hash without a space as text', () => {
    expect(roundtrip('#nospace')).toBe('#nospace\n')
  })

  it('preserves a lone hash', () => {
    expect(roundtrip('#')).toBe('#\n')
  })

  it('keeps emphasis markers in a heading', () => {
    expect(roundtrip('# with *stars*')).toBe('# with *stars*\n')
  })

  it.fails('does not keep a trailing closing hash', () => {
    expect(roundtrip('# trailing #')).toBe('# trailing #\n')
  })

  it.fails('does not collapse extra space after the hash', () => {
    expect(roundtrip('#  extra')).toBe('#  extra\n')
  })

  it.fails('does not keep an empty heading trailing space', () => {
    expect(roundtrip('# ')).toBe('# \n')
  })

  it.fails('drops setext heading text (level 1)', () => {
    expect(roundtrip('Setext1\n===')).toBe('Setext1\n===\n')
  })

  it.fails('drops setext heading text (level 2)', () => {
    expect(roundtrip('Setext2\n---')).toBe('Setext2\n---\n')
  })
})

describe('round-trip edge cases: blockquotes', () => {
  it('preserves a simple blockquote', () => {
    expect(roundtrip('> quote')).toBe('> quote\n')
  })

  it('preserves a blockquote with an inner blank line', () => {
    expect(roundtrip('> p1\n>\n> p2')).toBe('> p1\n>\n> p2\n')
  })

  it('preserves an empty blockquote marker', () => {
    expect(roundtrip('>')).toBe('>\n')
  })

  it('preserves a heading inside a blockquote', () => {
    expect(roundtrip('> # heading')).toBe('> # heading\n')
  })

  it('preserves a blockquote between paragraphs', () => {
    expect(roundtrip('x\n\n> q\n\ny')).toBe('x\n\n> q\n\ny\n')
  })

  it.fails('does not keep a trailing space after the quote marker', () => {
    expect(roundtrip('> ')).toBe('> \n')
  })

  it.fails('leaks the second quote mark into the text', () => {
    expect(roundtrip('> l1\n> l2')).toBe('> l1\n> l2\n')
  })

  it.fails('rewrites a lazily-nested blockquote', () => {
    expect(roundtrip('> a\n>> b')).toBe('> a\n>> b\n')
  })

  it.fails('appends quote lines after a nested list', () => {
    expect(roundtrip('> - item')).toBe('> - item\n')
  })
})

describe('round-trip edge cases: bullet lists', () => {
  it('preserves a single bullet', () => {
    expect(roundtrip('- item')).toBe('- item\n')
  })

  it('preserves a nested bullet at a 2-space indent', () => {
    expect(roundtrip('- a\n  - nested')).toBe('- a\n  - nested\n')
  })

  it('preserves a loose item holding two blocks', () => {
    expect(roundtrip('- a\n\n  para2')).toBe('- a\n\n  para2\n')
  })

  it('preserves a bare empty bullet', () => {
    expect(roundtrip('-')).toBe('-\n')
  })

  it.fails('normalizes an asterisk bullet to a dash', () => {
    expect(roundtrip('* star')).toBe('* star\n')
  })

  it.fails('normalizes a plus bullet to a dash', () => {
    expect(roundtrip('+ plus')).toBe('+ plus\n')
  })

  it.fails('normalizes a 4-space nested indent to 2 spaces', () => {
    expect(roundtrip('- a\n    - deep')).toBe('- a\n    - deep\n')
  })

  it.fails('collapses a loose single-paragraph list to tight', () => {
    expect(roundtrip('- a\n\n- b')).toBe('- a\n\n- b\n')
  })
})

describe('round-trip edge cases: ordered lists', () => {
  it('preserves an ordered item', () => {
    expect(roundtrip('1. one')).toBe('1. one\n')
  })

  it('preserves a two-digit start number', () => {
    expect(roundtrip('10. ten')).toBe('10. ten\n')
  })

  it('preserves a zero start number', () => {
    expect(roundtrip('0. zero')).toBe('0. zero\n')
  })

  it('preserves a nested ordered list', () => {
    expect(roundtrip('1. a\n   1. nested')).toBe('1. a\n   1. nested\n')
  })

  it.fails('renumbers sequential items to the start number', () => {
    expect(roundtrip('1. one\n2. two')).toBe('1. one\n2. two\n')
  })

  it.fails('normalizes a paren delimiter to a dot', () => {
    expect(roundtrip('1) paren')).toBe('1) paren\n')
  })

  it.fails('renumbers empty ordered items', () => {
    expect(roundtrip('1.\n2.')).toBe('1.\n2.\n')
  })
})

describe('round-trip edge cases: task lists', () => {
  it('preserves an empty task marker', () => {
    expect(roundtrip('- [ ]')).toBe('- [ ]\n')
  })

  it('keeps a task marker literal in an ordered item', () => {
    expect(roundtrip('1. [x] otask')).toBe('1. [x] otask\n')
  })

  it('preserves a nested task under a task', () => {
    expect(roundtrip('- [ ] parent\n  - [x] child')).toBe('- [ ] parent\n  - [x] child\n')
  })

  it.fails('lowercases an uppercase task marker', () => {
    expect(roundtrip('- [X] upper')).toBe('- [X] upper\n')
  })

  it.fails('trims a trailing space after a task marker', () => {
    expect(roundtrip('- [ ] ')).toBe('- [ ] \n')
  })
})

describe('round-trip edge cases: code blocks', () => {
  it('preserves a fenced code block with language', () => {
    expect(roundtrip('```js\nconst x=1\n```')).toBe('```js\nconst x=1\n```\n')
  })

  it('preserves multi-line fenced code', () => {
    expect(roundtrip('```\nl1\nl2\n```')).toBe('```\nl1\nl2\n```\n')
  })

  it('preserves indentation inside a fence', () => {
    expect(roundtrip('```\n  indented in fence\n```')).toBe('```\n  indented in fence\n```\n')
  })

  it.fails('adds a blank line to an empty fence', () => {
    expect(roundtrip('```\n```')).toBe('```\n```\n')
  })

  it.fails('rewrites a tilde fence as backticks', () => {
    expect(roundtrip('~~~\ntilde\n~~~')).toBe('~~~\ntilde\n~~~\n')
  })

  it.fails('rewrites an indented code block as a fence', () => {
    expect(roundtrip('    indented')).toBe('    indented\n')
  })
})

describe('round-trip edge cases: thematic breaks', () => {
  it('preserves a dash rule', () => {
    expect(roundtrip('---')).toBe('---\n')
  })

  it('preserves a rule between paragraphs', () => {
    expect(roundtrip('---\n\nafter')).toBe('---\n\nafter\n')
  })

  it.fails('normalizes an asterisk rule to dashes', () => {
    expect(roundtrip('***')).toBe('***\n')
  })

  it.fails('normalizes an underscore rule to dashes', () => {
    expect(roundtrip('___')).toBe('___\n')
  })

  it.fails('normalizes a spaced rule to dashes', () => {
    expect(roundtrip('- - -')).toBe('- - -\n')
  })
})

describe('round-trip edge cases: tables', () => {
  it('preserves a single-column table', () => {
    expect(roundtrip('| a |\n| --- |\n| 1 |')).toBe('| a |\n| --- |\n| 1 |\n')
  })

  it('preserves a table with a missing cell', () => {
    expect(roundtrip('| h1 | h2 | h3 |\n| --- | --- | --- |\n| a |  | c |')).toBe(
      '| h1 | h2 | h3 |\n| --- | --- | --- |\n| a |  | c |\n',
    )
  })

  it.fails('drops column alignment', () => {
    expect(roundtrip('| a | b |\n| :-- | --: |\n| 1 | 2 |')).toBe(
      '| a | b |\n| :-- | --: |\n| 1 | 2 |\n',
    )
  })

  it.fails('double-escapes an escaped pipe', () => {
    expect(roundtrip('| a \\| b | c |\n| --- | --- |\n| 1 | 2 |')).toBe(
      '| a \\| b | c |\n| --- | --- |\n| 1 | 2 |\n',
    )
  })
})

describe('round-trip edge cases: escapes and whitespace', () => {
  it('preserves an escaped hash', () => {
    expect(roundtrip(String.raw`\# not heading`)).toBe('\\# not heading\n')
  })

  it('preserves an escaped dash', () => {
    expect(roundtrip(String.raw`\- not list`)).toBe('\\- not list\n')
  })

  it('preserves an escaped ordered marker', () => {
    expect(roundtrip(String.raw`1\. not ordered`)).toBe('1\\. not ordered\n')
  })

  it('serializes empty input as a single newline', () => {
    expect(roundtrip('')).toBe('\n')
  })

  it.fails('does not keep a whitespace-only line', () => {
    expect(roundtrip('   ')).toBe('   \n')
  })

  it.fails('collapses internal blank-line runs', () => {
    expect(roundtrip('a\n\n\n\nb')).toBe('a\n\n\n\nb\n')
  })

  it.fails('mangles YAML frontmatter', () => {
    expect(roundtrip('---\ntitle: x\n---')).toBe('---\ntitle: x\n---\n')
  })
})

describe('round-trip edge cases: mixed structures', () => {
  it('preserves a paragraph, list, paragraph sequence', () => {
    expect(roundtrip('para\n\n- list\n\npara2')).toBe('para\n\n- list\n\npara2\n')
  })

  it('preserves a heading, paragraph, list sequence', () => {
    expect(roundtrip('# h\n\npara\n\n- list')).toBe('# h\n\npara\n\n- list\n')
  })

  it('preserves a blockquote followed by a code block', () => {
    expect(roundtrip('> q\n\n```\ncode\n```')).toBe('> q\n\n```\ncode\n```\n')
  })

  it('preserves a code block inside a list item', () => {
    expect(roundtrip('- a\n\n  ```\n  code\n  ```')).toBe('- a\n\n  ```\n  code\n  ```\n')
  })

  it('preserves a table followed by a list', () => {
    expect(roundtrip('| a | b |\n| --- | --- |\n| 1 | 2 |\n\n- list')).toBe(
      '| a | b |\n| --- | --- |\n| 1 | 2 |\n\n- list\n',
    )
  })

  it.fails('inserts blank lines between stacked headings', () => {
    expect(roundtrip('# h1\n## h2\n### h3')).toBe('# h1\n## h2\n### h3\n')
  })

  it.fails('renumbers an ordered list before a paragraph', () => {
    expect(roundtrip('1. a\n2. b\n\npara')).toBe('1. a\n2. b\n\npara\n')
  })
})

describe('round-trip edge cases: idempotency', () => {
  it('is idempotent for a paragraph', () => {
    const once = roundtrip('hello')
    expect(roundtrip(once)).toBe(once)
  })

  it('is idempotent for a tight bullet list', () => {
    const once = roundtrip('- a\n- b')
    expect(roundtrip(once)).toBe(once)
  })

  it('is idempotent for a fenced code block', () => {
    const once = roundtrip('```\ncode\n```')
    expect(roundtrip(once)).toBe(once)
  })

  it('is idempotent for a table', () => {
    const once = roundtrip('| a | b |\n| --- | --- |\n| 1 | 2 |')
    expect(roundtrip(once)).toBe(once)
  })

  it('is idempotent after collapsing a loose list', () => {
    const once = roundtrip('- a\n\n- b')
    expect(roundtrip(once)).toBe(once)
  })

  it('is idempotent after normalizing a bullet marker', () => {
    const once = roundtrip('* star')
    expect(roundtrip(once)).toBe(once)
  })

  it('is idempotent after lowercasing a task marker', () => {
    const once = roundtrip('- [X] upper')
    expect(roundtrip(once)).toBe(once)
  })

  it('is idempotent after renumbering an ordered list', () => {
    const once = roundtrip('1. one\n2. two')
    expect(roundtrip(once)).toBe(once)
  })

  it('is idempotent for a lazily-nested blockquote', () => {
    const once = roundtrip('> a\n>> b')
    expect(roundtrip(once)).toBe(once)
  })

  it('is idempotent for mangled frontmatter', () => {
    const once = roundtrip('---\ntitle: x\n---')
    expect(roundtrip(once)).toBe(once)
  })

  it.fails('is not idempotent: a blockquote keeps gaining a quote mark', () => {
    const once = roundtrip('> l1\n> l2')
    expect(roundtrip(once)).toBe(once)
  })

  it.fails('is not idempotent: an empty fence keeps gaining a blank line', () => {
    const once = roundtrip('```\n```')
    expect(roundtrip(once)).toBe(once)
  })
})
