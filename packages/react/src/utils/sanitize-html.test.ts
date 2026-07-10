import { describe, expect, it } from 'vitest'

import { sanitizeHTMLBlock } from './sanitize-html.ts'

/** Serialize the sanitized fragment to an HTML string for assertions. */
function sanitizeToHTML(source: string): string {
  const container = document.createElement('div')
  container.append(sanitizeHTMLBlock(source))
  return container.innerHTML
}

describe('sanitizeHTMLBlock', () => {
  it('keeps a plain element', () => {
    expect(sanitizeToHTML('<div>hello</div>')).toBe('<div>hello</div>')
  })

  it('drops a script tag', () => {
    expect(sanitizeToHTML('<div>ok</div><script>alert(1)</script>')).toBe('<div>ok</div>')
  })

  it('drops an inline event handler', () => {
    const html = sanitizeToHTML('<img src="x.png" onerror="alert(1)">')
    expect(html).toContain('src="x.png"')
    expect(html).not.toContain('onerror')
  })

  it('drops a javascript: href', () => {
    const html = sanitizeToHTML('<a href="javascript:alert(1)">click</a>')
    expect(html).not.toContain('javascript:')
  })

  it('drops an iframe', () => {
    expect(sanitizeToHTML('<iframe src="https://evil.example"></iframe>')).toBe('')
  })

  it('drops a form control', () => {
    expect(sanitizeToHTML('<input value="x">')).toBe('')
  })

  it('keeps a style attribute', () => {
    expect(sanitizeToHTML('<span style="color: red">hi</span>')).toContain('style="color: red"')
  })

  it('keeps details and summary with the open attribute', () => {
    const html = sanitizeToHTML('<details open><summary>More</summary>body</details>')
    expect(html).toContain('<details open="">')
    expect(html).toContain('<summary>More</summary>')
  })

  it('keeps sizing and alignment attributes on an image', () => {
    const html = sanitizeToHTML('<img src="a.png" width="100" align="left">')
    expect(html).toContain('width="100"')
    expect(html).toContain('align="left"')
  })

  it('renders nothing visible for a comment', () => {
    const container = document.createElement('div')
    container.append(sanitizeHTMLBlock('<!-- just a note -->'))
    expect(container.textContent).toBe('')
  })
})
