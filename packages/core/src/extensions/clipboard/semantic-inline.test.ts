import { formatHTML } from 'diffable-html-snapshot'
import { describe, expect, it } from 'vitest'

import { markdownToDoc } from '../../converters/md-to-pm.ts'
import { setupFixture, type Fixture } from '../../testing/index.ts'
import { headingClipboardDOM } from '../heading.ts'
import { paragraphClipboardDOM } from '../paragraph.ts'

function firstTextblockDOM(fixture: Fixture, markdown: string): string {
  const { editor, view } = fixture
  fixture.set(markdownToDoc(markdown, { nodes: editor.nodes }))
  const textblock = view.state.doc.child(0)
  const element =
    textblock.type.name === 'heading'
      ? headingClipboardDOM(textblock)
      : paragraphClipboardDOM(textblock)
  return formatHTML(element.outerHTML)
}

describe('paragraphClipboardDOM', () => {
  it('serializes plain text', () => {
    using fixture = setupFixture()
    expect(firstTextblockDOM(fixture, 'hello')).toMatchInlineSnapshot(`
      "
      <p data-md="hello">
        hello
      </p>
      "
    `)
  })

  it('drops syntax characters and wraps semantic marks', () => {
    using fixture = setupFixture()
    expect(firstTextblockDOM(fixture, 'a **b** *c* `d` ~~e~~ ==f==')).toMatchInlineSnapshot(`
      "
      <p data-md="a **b** *c* \`d\` ~~e~~ ==f==">
        a
        <strong>
          b
        </strong>
        <em>
          c
        </em>
        <code>
          d
        </code>
        <del>
          e
        </del>
        <mark>
          f
        </mark>
      </p>
      "
    `)
  })

  it('keeps mark nesting', () => {
    using fixture = setupFixture()
    expect(firstTextblockDOM(fixture, '**bold *italic* bold**')).toMatchInlineSnapshot(`
      "
      <p data-md="**bold *italic* bold**">
        <strong>
          bold
          <em>
            italic
          </em>
          bold
        </strong>
      </p>
      "
    `)
  })

  it('serializes a link with its href', () => {
    using fixture = setupFixture()
    expect(firstTextblockDOM(fixture, 'see [docs](https://example.com)')).toMatchInlineSnapshot(`
      "
      <p data-md="see [docs](https://example.com)">
        see
        <a href="https://example.com">
          docs
        </a>
      </p>
      "
    `)
  })

  it('serializes a bare autolink', () => {
    using fixture = setupFixture()
    expect(firstTextblockDOM(fixture, 'visit https://example.com now')).toMatchInlineSnapshot(`
      "
      <p data-md="visit https://example.com now">
        visit
        <a href="https://example.com">
          https://example.com
        </a>
        now
      </p>
      "
    `)
  })

  it('replaces an image source with an img element', () => {
    using fixture = setupFixture()
    expect(firstTextblockDOM(fixture, 'see ![cat](https://example.com/cat.png) end'))
      .toMatchInlineSnapshot(`
      "
      <p data-md="see ![cat](https://example.com/cat.png) end">
        see
        <img
          alt="cat"
          src="https://example.com/cat.png"
        >
        end
      </p>
      "
    `)
  })

  it('renders wikilink display text', () => {
    using fixture = setupFixture()
    expect(firstTextblockDOM(fixture, 'see [[note]] end')).toMatchInlineSnapshot(`
      "
      <p data-md="see [[note]] end">
        see note end
      </p>
      "
    `)
  })

  it('keeps math source text', () => {
    using fixture = setupFixture()
    expect(firstTextblockDOM(fixture, 'see $E=mc^2$ end')).toMatchInlineSnapshot(`
      "
      <p data-md="see $E=mc^2$ end">
        see $E=mc^2$ end
      </p>
      "
    `)
  })

  it('keeps a tag as plain text', () => {
    using fixture = setupFixture()
    expect(firstTextblockDOM(fixture, 'hello #meow end')).toMatchInlineSnapshot(`
      "
      <p data-md="hello #meow end">
        hello #meow end
      </p>
      "
    `)
  })

  it('renders a soft break as br', () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph('line1\nline2')))
    const element = paragraphClipboardDOM(view.state.doc.child(0))
    expect(formatHTML(element.outerHTML)).toMatchInlineSnapshot(`
      "
      <p data-md="line1
      line2">
        line1
        <br>
        line2
      </p>
      "
    `)
  })

  it('serializes an empty paragraph', () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph()))
    const element = paragraphClipboardDOM(view.state.doc.child(0))
    expect(formatHTML(element.outerHTML)).toMatchInlineSnapshot(`
      "
      <p data-md>
      </p>
      "
    `)
  })
})

describe('headingClipboardDOM', () => {
  it('serializes an ATX heading with the source prefix in data-md', () => {
    using fixture = setupFixture()
    expect(firstTextblockDOM(fixture, '### a **b**')).toMatchInlineSnapshot(`
      "
      <h3 data-md="a **b**">
        a
        <strong>
          b
        </strong>
      </h3>
      "
    `)
  })

  it('keeps setext underline metadata', () => {
    using fixture = setupFixture()
    expect(firstTextblockDOM(fixture, 'title\n=====')).toMatchInlineSnapshot(`
      "
      <h1
        data-md="title"
        data-setext-underline="5"
      >
        title
      </h1>
      "
    `)
  })

  it('keeps closing hashes metadata', () => {
    using fixture = setupFixture()
    expect(firstTextblockDOM(fixture, '## title ##')).toMatchInlineSnapshot(`
      "
      <h2
        data-closing-hashes="2"
        data-md="title"
      >
        title
      </h2>
      "
    `)
  })
})
