import type { Root, Text } from 'mdast'
import type { State, Unsafe } from 'mdast-util-to-markdown'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'

import { htmlToMarkdown, toMeowdownUnsafe } from './html-to-md.ts'

describe('htmlToMarkdown', () => {
  it('converts strong and em to meowdown dialect', () => {
    expect(htmlToMarkdown('<p>hi <strong>bold</strong> and <em>italic</em></p>').trim()).toBe(
      'hi **bold** and *italic*',
    )
  })

  it('converts a bullet list with a dash marker', () => {
    expect(htmlToMarkdown('<ul><li>one</li><li>two</li></ul>').trim()).toBe('- one\n- two')
  })

  it('converts an ordered list', () => {
    expect(htmlToMarkdown('<ol><li>a</li><li>b</li></ol>').trim()).toBe('1. a\n2. b')
  })

  it('converts links, inline code, and strikethrough', () => {
    expect(htmlToMarkdown('<a href="https://x.com">link</a>').trim()).toBe('[link](https://x.com)')
    expect(htmlToMarkdown('<p><code>x</code></p>').trim()).toBe('`x`')
    expect(htmlToMarkdown('<del>gone</del>').trim()).toBe('~~gone~~')
  })

  it('converts a mark element to ==highlight==', () => {
    expect(htmlToMarkdown('<mark>highlighted</mark>').trim()).toBe('==highlighted==')
    expect(htmlToMarkdown('<p>hi <mark>there</mark> end</p>').trim()).toBe('hi ==there== end')
  })

  it('keeps a line-leading mark unescaped', () => {
    // A literal leading `==` would be escaped to `\==` to guard a setext
    // heading; writing it through the highlight construct must not be.
    expect(htmlToMarkdown('<p><mark>start</mark> rest</p>').trim()).toBe('==start== rest')
  })

  it('keeps nested formatting inside a mark', () => {
    expect(htmlToMarkdown('<p><mark><strong>bold</strong></mark></p>').trim()).toBe('==**bold**==')
    expect(htmlToMarkdown('<p>a <mark>x</mark> and <del>y</del></p>').trim()).toBe(
      'a ==x== and ~~y~~',
    )
  })

  it('converts a heading and a blockquote', () => {
    expect(htmlToMarkdown('<h2>Title</h2><blockquote><p>q</p></blockquote>').trim()).toBe(
      '## Title\n\n> q',
    )
  })

  it('converts a GFM table', () => {
    const html =
      '<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
    expect(htmlToMarkdown(html).trim()).toBe('| a | b |\n| - | - |\n| 1 | 2 |')
  })

  it('converts a GFM task list', () => {
    const html =
      '<ul><li><input type="checkbox" disabled> one</li><li><input type="checkbox" checked disabled> two</li></ul>'
    expect(htmlToMarkdown(html).trim()).toBe('- [ ] one\n- [x] two')
  })

  it('converts a tiptap-style task list', () => {
    // Tiptap nests the checkbox in a <label> and the body in a <div>, a shape
    // the stock `li` handler misses (the item would lose its checkbox).
    const html =
      '<ul data-type="taskList">' +
      '<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>one</p></div></li>' +
      '<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked><span></span></label><div><p>two</p></div></li>' +
      '</ul>'
    expect(htmlToMarkdown(html).trim()).toBe('- [ ] one\n- [x] two')
  })

  it('converts a remirror-style task list', () => {
    // Remirror marks checked items with a bare data-checked attribute.
    const html =
      '<ul><li data-task-list-item="" data-checked=""><p>done</p></li><li data-task-list-item=""><p>open</p></li></ul>'
    expect(htmlToMarkdown(html).trim()).toBe('- [x] done\n- [ ] open')
  })

  it('does not escape characters that are inert in meowdown', () => {
    // A lone `[` or `~` can never change meaning (no reference links or
    // definitions, no single-tilde strikethrough), so escaping them would only
    // leave literal backslash noise in the pasted source.
    expect(htmlToMarkdown('<p>[foo] and ~5 items</p>').trim()).toBe('[foo] and ~5 items')
    expect(htmlToMarkdown('<p>see [[my note]] ok</p>').trim()).toBe('see [[my note]] ok')
    expect(htmlToMarkdown('<p>[foo]: bar</p>').trim()).toBe('[foo]: bar')
    expect(htmlToMarkdown('<p>x ~ y</p>').trim()).toBe('x ~ y')
    expect(htmlToMarkdown('<p>a ~d~ b</p>').trim()).toBe('a ~d~ b')
  })

  it('lets a literal ~~pair~~ become strikethrough', () => {
    expect(htmlToMarkdown('<p>a ~~pair~~ b</p>').trim()).toBe('a ~~pair~~ b')
  })

  it('still escapes a line-leading tilde run', () => {
    // A bare `~~~` at the start of a line would open a code fence that
    // swallows the following content on reparse.
    expect(htmlToMarkdown('<p>~~~ maybe fence</p>').trim()).toBe(String.raw`\~~~ maybe fence`)
  })

  it('still escapes brackets inside a link label', () => {
    expect(htmlToMarkdown('<p><a href="u">a ]b</a></p>').trim()).toBe(String.raw`[a \]b](u)`)
    expect(htmlToMarkdown('<p><a href="u">a [b</a></p>').trim()).toBe(String.raw`[a \[b](u)`)
  })

  it('still escapes syntax that meowdown would render', () => {
    expect(htmlToMarkdown('<p>a `tick` and *star*</p>').trim()).toBe('a \\`tick\\` and \\*star\\*')
  })
})

/** The runtime `state.unsafe` that `remark-gfm` + `remark-stringify` assemble. */
function captureStockUnsafe(): Unsafe[] {
  let unsafe: Unsafe[] = []
  const root: Root = {
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', value: 'x' }] }],
  }
  unified()
    .use(remarkGfm)
    .use(remarkStringify, {
      handlers: {
        text: (node: Text, _parent: unknown, state: State) => {
          unsafe = state.unsafe
          return node.value
        },
      },
    })
    .stringify(root)
  return unsafe
}

describe('toMeowdownUnsafe', () => {
  it('narrows the stock escaping rules', () => {
    const format = (rules: Unsafe[]): unknown => {
      let text = ""
      try {
        text = JSON.stringify(rules.map(x => ({...x, _compiled: undefined })), null, 2)
      } catch (e) {
        text = ``
      }
      console.log("text",text)
      const result = text && JSON.parse(text)
      console.log("result", result)
      return  result
    }

    const stock = captureStockUnsafe()
    expect(format(stock)).toMatchInlineSnapshot()
    expect(format(toMeowdownUnsafe(stock))).toMatchInlineSnapshot( )
  })
})
