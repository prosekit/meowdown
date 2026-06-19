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

// Edge cases. `it` keeps the input through a round-trip; `it.fails` marks a
// known defect (it asserts the same ideal, which currently fails).

describe('text', () => {
  it('keeps soft breaks', () => {
    expect(roundtrip('a\nb\nc')).toBe('a\nb\nc\n')
  })

  it('keeps a blank line between paragraphs', () => {
    expect(roundtrip('line1\n\nline2')).toBe('line1\n\nline2\n')
  })

  it('keeps a tab', () => {
    expect(roundtrip('tab\tinside')).toBe('tab\tinside\n')
  })

  it('keeps accented characters', () => {
    expect(roundtrip('café résumé')).toBe('café résumé\n')
  })

  it('keeps emoji', () => {
    expect(roundtrip('emoji 🎉 test')).toBe('emoji 🎉 test\n')
  })

  it('keeps CJK text', () => {
    expect(roundtrip('CJK 中文 テスト')).toBe('CJK 中文 テスト\n')
  })

  it('keeps multiple spaces', () => {
    expect(roundtrip('a  b  spaces')).toBe('a  b  spaces\n')
  })

  it('keeps a literal backslash', () => {
    expect(roundtrip(String.raw`backslash \ here`)).toBe('backslash \\ here\n')
  })

  it('keeps angle brackets and ampersands', () => {
    expect(roundtrip('amp & lt < gt >')).toBe('amp & lt < gt >\n')
  })

  it.fails('keeps trailing spaces', () => {
    expect(roundtrip('trailing spaces   ')).toBe('trailing spaces   \n')
  })
})

describe('inline', () => {
  it('keeps bold markers', () => {
    expect(roundtrip('**bold**')).toBe('**bold**\n')
  })

  it('keeps italic markers', () => {
    expect(roundtrip('*italic*')).toBe('*italic*\n')
  })

  it('keeps strikethrough markers', () => {
    expect(roundtrip('~~strike~~')).toBe('~~strike~~\n')
  })

  it('keeps inline code', () => {
    expect(roundtrip('`inline`')).toBe('`inline`\n')
  })

  it('keeps a link', () => {
    expect(roundtrip('[link](url)')).toBe('[link](url)\n')
  })

  it('keeps an image', () => {
    expect(roundtrip('![img](src)')).toBe('![img](src)\n')
  })

  it('keeps an angle autolink', () => {
    expect(roundtrip('<https://auto.com>')).toBe('<https://auto.com>\n')
  })

  it('keeps an aliased wikilink', () => {
    expect(roundtrip('[[note|alias]]')).toBe('[[note|alias]]\n')
  })

  it('keeps a hashtag', () => {
    expect(roundtrip('#hashtag')).toBe('#hashtag\n')
  })

  it('keeps escaped emphasis', () => {
    expect(roundtrip(String.raw`foo \*esc\*`)).toBe('foo \\*esc\\*\n')
  })

  it.fails('keeps a raw HTML block', () => {
    expect(roundtrip('<div>html</div>')).toBe('<div>html</div>\n')
  })

  it.fails('keeps an HTML comment', () => {
    expect(roundtrip('<!-- comment -->')).toBe('<!-- comment -->\n')
  })
})

describe('headings', () => {
  it('keeps a level-6 heading', () => {
    expect(roundtrip('###### H6')).toBe('###### H6\n')
  })

  it('keeps seven hashes as text', () => {
    expect(roundtrip('####### seven')).toBe('####### seven\n')
  })

  it('keeps a spaceless hash as text', () => {
    expect(roundtrip('#nospace')).toBe('#nospace\n')
  })

  it('keeps a lone hash', () => {
    expect(roundtrip('#')).toBe('#\n')
  })

  it('keeps emphasis in a heading', () => {
    expect(roundtrip('# with *stars*')).toBe('# with *stars*\n')
  })

  it.fails('keeps a trailing closing hash', () => {
    expect(roundtrip('# trailing #')).toBe('# trailing #\n')
  })

  it.fails('keeps extra space after the hash', () => {
    expect(roundtrip('#  extra')).toBe('#  extra\n')
  })

  it.fails('keeps an empty heading trailing space', () => {
    expect(roundtrip('# ')).toBe('# \n')
  })

  it.fails('keeps setext text (level 1)', () => {
    expect(roundtrip('Setext1\n===')).toBe('Setext1\n===\n')
  })

  it.fails('keeps setext text (level 2)', () => {
    expect(roundtrip('Setext2\n---')).toBe('Setext2\n---\n')
  })
})

describe('blockquotes', () => {
  it('keeps a simple quote', () => {
    expect(roundtrip('> quote')).toBe('> quote\n')
  })

  it('keeps an inner blank line', () => {
    expect(roundtrip('> p1\n>\n> p2')).toBe('> p1\n>\n> p2\n')
  })

  it('keeps an empty quote marker', () => {
    expect(roundtrip('>')).toBe('>\n')
  })

  it('keeps a heading in a quote', () => {
    expect(roundtrip('> # heading')).toBe('> # heading\n')
  })

  it('keeps a quote between paragraphs', () => {
    expect(roundtrip('x\n\n> q\n\ny')).toBe('x\n\n> q\n\ny\n')
  })

  it.fails('keeps a trailing space after the marker', () => {
    expect(roundtrip('> ')).toBe('> \n')
  })

  it.fails('keeps a two-line quote', () => {
    expect(roundtrip('> l1\n> l2')).toBe('> l1\n> l2\n')
  })

  it.fails('keeps a lazily-nested quote', () => {
    expect(roundtrip('> a\n>> b')).toBe('> a\n>> b\n')
  })

  it.fails('keeps a nested list in a quote', () => {
    expect(roundtrip('> - item')).toBe('> - item\n')
  })
})

describe('bullet lists', () => {
  it('keeps a single bullet', () => {
    expect(roundtrip('- item')).toBe('- item\n')
  })

  it('keeps a nested bullet', () => {
    expect(roundtrip('- a\n  - nested')).toBe('- a\n  - nested\n')
  })

  it('keeps a loose two-block item', () => {
    expect(roundtrip('- a\n\n  para2')).toBe('- a\n\n  para2\n')
  })

  it('keeps a bare empty bullet', () => {
    expect(roundtrip('-')).toBe('-\n')
  })

  it.fails('keeps an asterisk bullet', () => {
    expect(roundtrip('* star')).toBe('* star\n')
  })

  it.fails('keeps a plus bullet', () => {
    expect(roundtrip('+ plus')).toBe('+ plus\n')
  })

  it.fails('keeps a 4-space nested indent', () => {
    expect(roundtrip('- a\n    - deep')).toBe('- a\n    - deep\n')
  })

  it.fails('keeps a loose list', () => {
    expect(roundtrip('- a\n\n- b')).toBe('- a\n\n- b\n')
  })

  it.fails('keeps a trailing space after the marker', () => {
    expect(roundtrip('- ')).toBe('- \n')
  })

  it.fails('keeps a trailing space on an empty item', () => {
    expect(roundtrip('- a\n- \n- b')).toBe('- a\n- \n- b\n')
  })
})

describe('ordered lists', () => {
  it('keeps an ordered item', () => {
    expect(roundtrip('1. one')).toBe('1. one\n')
  })

  it('keeps a two-digit start', () => {
    expect(roundtrip('10. ten')).toBe('10. ten\n')
  })

  it('keeps a zero start', () => {
    expect(roundtrip('0. zero')).toBe('0. zero\n')
  })

  it('keeps a nested ordered list', () => {
    expect(roundtrip('1. a\n   1. nested')).toBe('1. a\n   1. nested\n')
  })

  it.fails('keeps sequential numbers', () => {
    expect(roundtrip('1. one\n2. two')).toBe('1. one\n2. two\n')
  })

  it.fails('keeps a paren delimiter', () => {
    expect(roundtrip('1) paren')).toBe('1) paren\n')
  })

  it.fails('keeps empty item numbers', () => {
    expect(roundtrip('1.\n2.')).toBe('1.\n2.\n')
  })
})

describe('task lists', () => {
  it('keeps an empty task marker', () => {
    expect(roundtrip('- [ ]')).toBe('- [ ]\n')
  })

  it('keeps a task marker in an ordered item', () => {
    expect(roundtrip('1. [x] otask')).toBe('1. [x] otask\n')
  })

  it('keeps a nested task', () => {
    expect(roundtrip('- [ ] parent\n  - [x] child')).toBe('- [ ] parent\n  - [x] child\n')
  })

  it.fails('keeps an uppercase marker', () => {
    expect(roundtrip('- [X] upper')).toBe('- [X] upper\n')
  })

  it.fails('keeps a trailing space after the marker', () => {
    expect(roundtrip('- [ ] ')).toBe('- [ ] \n')
  })
})

describe('code blocks', () => {
  it('keeps a fenced block with language', () => {
    expect(roundtrip('```js\nconst x=1\n```')).toBe('```js\nconst x=1\n```\n')
  })

  it('keeps multi-line fenced code', () => {
    expect(roundtrip('```\nl1\nl2\n```')).toBe('```\nl1\nl2\n```\n')
  })

  it('keeps indentation in a fence', () => {
    expect(roundtrip('```\n  indented in fence\n```')).toBe('```\n  indented in fence\n```\n')
  })

  it.fails('keeps an empty fence', () => {
    expect(roundtrip('```\n```')).toBe('```\n```\n')
  })

  it.fails('keeps a tilde fence', () => {
    expect(roundtrip('~~~\ntilde\n~~~')).toBe('~~~\ntilde\n~~~\n')
  })

  it.fails('keeps an indented code block', () => {
    expect(roundtrip('    indented')).toBe('    indented\n')
  })
})

describe('thematic breaks', () => {
  it('keeps a dash rule', () => {
    expect(roundtrip('---')).toBe('---\n')
  })

  it('keeps a rule between paragraphs', () => {
    expect(roundtrip('---\n\nafter')).toBe('---\n\nafter\n')
  })

  it.fails('keeps an asterisk rule', () => {
    expect(roundtrip('***')).toBe('***\n')
  })

  it.fails('keeps an underscore rule', () => {
    expect(roundtrip('___')).toBe('___\n')
  })

  it.fails('keeps a spaced rule', () => {
    expect(roundtrip('- - -')).toBe('- - -\n')
  })
})

describe('tables', () => {
  it('keeps a single-column table', () => {
    expect(roundtrip('| a |\n| --- |\n| 1 |')).toBe('| a |\n| --- |\n| 1 |\n')
  })

  it('keeps a missing cell', () => {
    expect(roundtrip('| h1 | h2 | h3 |\n| --- | --- | --- |\n| a |  | c |')).toBe(
      '| h1 | h2 | h3 |\n| --- | --- | --- |\n| a |  | c |\n',
    )
  })

  it.fails('keeps column alignment', () => {
    expect(roundtrip('| a | b |\n| :-- | --: |\n| 1 | 2 |')).toBe(
      '| a | b |\n| :-- | --: |\n| 1 | 2 |\n',
    )
  })

  it.fails('keeps an escaped pipe', () => {
    expect(roundtrip('| a \\| b | c |\n| --- | --- |\n| 1 | 2 |')).toBe(
      '| a \\| b | c |\n| --- | --- |\n| 1 | 2 |\n',
    )
  })
})

describe('escapes and whitespace', () => {
  it('keeps an escaped hash', () => {
    expect(roundtrip(String.raw`\# not heading`)).toBe('\\# not heading\n')
  })

  it('keeps an escaped dash', () => {
    expect(roundtrip(String.raw`\- not list`)).toBe('\\- not list\n')
  })

  it('keeps an escaped ordered marker', () => {
    expect(roundtrip(String.raw`1\. not ordered`)).toBe('1\\. not ordered\n')
  })

  it('keeps empty input as one newline', () => {
    expect(roundtrip('')).toBe('\n')
  })

  it.fails('keeps a whitespace-only line', () => {
    expect(roundtrip('   ')).toBe('   \n')
  })

  it.fails('keeps internal blank-line runs', () => {
    expect(roundtrip('a\n\n\n\nb')).toBe('a\n\n\n\nb\n')
  })

  it.fails('keeps YAML frontmatter', () => {
    expect(roundtrip('---\ntitle: x\n---')).toBe('---\ntitle: x\n---\n')
  })
})

describe('mixed structures', () => {
  it('keeps a paragraph-list-paragraph sequence', () => {
    expect(roundtrip('para\n\n- list\n\npara2')).toBe('para\n\n- list\n\npara2\n')
  })

  it('keeps a heading-paragraph-list sequence', () => {
    expect(roundtrip('# h\n\npara\n\n- list')).toBe('# h\n\npara\n\n- list\n')
  })

  it('keeps a quote then a code block', () => {
    expect(roundtrip('> q\n\n```\ncode\n```')).toBe('> q\n\n```\ncode\n```\n')
  })

  it('keeps a code block in a list item', () => {
    expect(roundtrip('- a\n\n  ```\n  code\n  ```')).toBe('- a\n\n  ```\n  code\n  ```\n')
  })

  it('keeps a table then a list', () => {
    expect(roundtrip('| a | b |\n| --- | --- |\n| 1 | 2 |\n\n- list')).toBe(
      '| a | b |\n| --- | --- |\n| 1 | 2 |\n\n- list\n',
    )
  })

  it.fails('keeps stacked headings tight', () => {
    expect(roundtrip('# h1\n## h2\n### h3')).toBe('# h1\n## h2\n### h3\n')
  })

  it.fails('keeps ordered numbers before a paragraph', () => {
    expect(roundtrip('1. a\n2. b\n\npara')).toBe('1. a\n2. b\n\npara\n')
  })
})

describe('idempotency', () => {
  it('keeps a paragraph stable', () => {
    const once = roundtrip('hello')
    expect(roundtrip(once)).toBe(once)
  })

  it('keeps a tight list stable', () => {
    const once = roundtrip('- a\n- b')
    expect(roundtrip(once)).toBe(once)
  })

  it('keeps a fenced block stable', () => {
    const once = roundtrip('```\ncode\n```')
    expect(roundtrip(once)).toBe(once)
  })

  it('keeps a table stable', () => {
    const once = roundtrip('| a | b |\n| --- | --- |\n| 1 | 2 |')
    expect(roundtrip(once)).toBe(once)
  })

  it('keeps a collapsed loose list stable', () => {
    const once = roundtrip('- a\n\n- b')
    expect(roundtrip(once)).toBe(once)
  })

  it('keeps a normalized asterisk bullet stable', () => {
    const once = roundtrip('* star')
    expect(roundtrip(once)).toBe(once)
  })

  it('keeps a lowercased task marker stable', () => {
    const once = roundtrip('- [X] upper')
    expect(roundtrip(once)).toBe(once)
  })

  it('keeps a renumbered list stable', () => {
    const once = roundtrip('1. one\n2. two')
    expect(roundtrip(once)).toBe(once)
  })

  it('keeps a lazily-nested quote stable', () => {
    const once = roundtrip('> a\n>> b')
    expect(roundtrip(once)).toBe(once)
  })

  it('keeps mangled frontmatter stable', () => {
    const once = roundtrip('---\ntitle: x\n---')
    expect(roundtrip(once)).toBe(once)
  })

  it.fails('keeps a two-line quote stable', () => {
    const once = roundtrip('> l1\n> l2')
    expect(roundtrip(once)).toBe(once)
  })

  it.fails('keeps an empty fence stable', () => {
    const once = roundtrip('```\n```')
    expect(roundtrip(once)).toBe(once)
  })
})
