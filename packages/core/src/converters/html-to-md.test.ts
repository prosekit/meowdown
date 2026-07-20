import { describe, expect, it } from 'vitest'

import { htmlToMarkdown } from './html-to-md.ts'

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

  it('does not escape brackets and tildes', () => {
    // A lone `[`, `]` or `~` is inert in meowdown (no reference links, no
    // single-tilde strikethrough), so escaping them would only add literal
    // backslash noise to the pasted text.
    expect(htmlToMarkdown('<p>[foo] and ~5 items</p>').trim()).toBe('[foo] and ~5 items')
    expect(htmlToMarkdown('<p>see [[my note]] ok</p>').trim()).toBe('see [[my note]] ok')
  })

  it('still escapes syntax that meowdown would render', () => {
    expect(htmlToMarkdown('<p>a `tick` and *star*</p>').trim()).toBe('a \\`tick\\` and \\*star\\*')
  })
})
