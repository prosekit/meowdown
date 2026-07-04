import { isFirefox } from '@meowdown/vitest/helpers'
import { TextSelection } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { findText } from '../testing/find-text.ts'
import { setupFixture } from '../testing/index.ts'

import { defineImage } from './image.ts'
import { defineMarkMode, type MarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')

/** Mount one paragraph in `mode` (caret at `<a>`) and freeze the rendered HTML. */
function renderHTML(mode: MarkMode, text: string): string {
  using fixture = setupFixture()
  fixture.editor.use(defineMarkMode(mode))
  const { n } = fixture
  fixture.set(n.doc(n.paragraph(text)))
  return fixture.htmlSnapshot
}

/** Mount one paragraph in `mode` and assert what a full-document copy yields (`null` = no serializer). */
function expectClipboard(mode: MarkMode, text: string, expected: string | null): void {
  using fixture = setupFixture()
  fixture.editor.use(defineMarkMode(mode))
  const { n } = fixture
  fixture.set(n.doc(n.paragraph(text)))
  const serialize = fixture.view.someProp('clipboardTextSerializer')
  const { doc } = fixture
  const actual = serialize ? serialize(doc.slice(0, doc.content.size), fixture.view) : null
  expect(actual).toBe(expected)
}

describe('focus mode', () => {
  it("sets data-mark-mode attribute to 'focus'", async () => {
    using fixture = setupFixture()
    fixture.editor.use(defineMarkMode('focus'))
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'focus')
  })

  it('reveals both ** when the cursor is inside **bold**', () => {
    expect(renderHTML('focus', 'Hello **<a>bold** end')).toMatchInlineSnapshot(`
      "
      <p>
        Hello
        <span
          class="md-pack"
          data-key="bold"
        >
          <strong>
            <span class="md-mark">
              <span class="show">
                **
              </span>
            </span>
            <span class="show">
              bold
            </span>
            <span class="md-mark">
              <span class="show">
                **
              </span>
            </span>
          </strong>
        </span>
        end
      </p>
      "
    `)
  })

  it('reveals nothing when the cursor is in plain text', () => {
    expect(renderHTML('focus', 'Hello<a> **bold** end')).toMatchInlineSnapshot(`
      "
      <p>
        Hello
        <span
          class="md-pack"
          data-key="bold"
        >
          <strong>
            <span class="md-mark">
              **
            </span>
            bold
            <span class="md-mark">
              **
            </span>
          </strong>
        </span>
        end
      </p>
      "
    `)
  })

  it('reveals only the adjacent marker pair, not unrelated bolds', () => {
    expect(renderHTML('focus', '**<a>one** plain **two**')).toMatchInlineSnapshot(`
      "
      <p>
        <span
          class="md-pack"
          data-key="bold"
        >
          <strong>
            <span class="md-mark">
              <span class="show">
                **
              </span>
            </span>
            <span class="show">
              one
            </span>
            <span class="md-mark">
              <span class="show">
                **
              </span>
            </span>
          </strong>
        </span>
        plain
        <span
          class="md-pack"
          data-key="bold"
        >
          <strong>
            <span class="md-mark">
              **
            </span>
            two
            <span class="md-mark">
              **
            </span>
          </strong>
        </span>
      </p>
      "
    `)
  })

  it('reveals nested wrappers (***foo***)', () => {
    expect(renderHTML('focus', '***<a>foo***')).toMatchInlineSnapshot(`
      "
      <p>
        <span
          class="md-pack"
          data-key="italic"
        >
          <em>
            <span class="md-mark">
              <span class="show">
                *
              </span>
            </span>
          </em>
          <span
            class="md-pack"
            data-key="bold"
          >
            <strong>
              <em>
                <span class="md-mark">
                  <span class="show">
                    **
                  </span>
                </span>
                <span class="show">
                  foo
                </span>
                <span class="md-mark">
                  <span class="show">
                    **
                  </span>
                </span>
              </em>
            </strong>
          </span>
          <em>
            <span class="md-mark">
              <span class="show">
                *
              </span>
            </span>
          </em>
        </span>
      </p>
      "
    `)
  })

  it('reveals every link marker when the cursor is in the text', () => {
    expect(renderHTML('focus', 'see [<a>docs](http://x.test)')).toMatchInlineSnapshot(`
      "
      <p>
        see
        <span
          class="md-pack"
          data-key="link"
        >
          <a
            class="md-link"
            href="http://x.test"
          >
            <span class="md-mark">
              <span class="show">
                [
              </span>
            </span>
            <span class="show">
              docs
            </span>
          </a>
          <span class="md-mark">
            <span class="show">
              ](
            </span>
          </span>
          <span class="md-link-uri">
            <span class="show">
              http://x.test
            </span>
          </span>
          <span class="md-mark">
            <span class="show">
              )
            </span>
          </span>
        </span>
      </p>
      "
    `)
  })

  it('reveals every link marker when the cursor is in the url', () => {
    expect(renderHTML('focus', 'see [docs](http<a>://x.test)')).toMatchInlineSnapshot(`
      "
      <p>
        see
        <span
          class="md-pack"
          data-key="link"
        >
          <a
            class="md-link"
            href="http://x.test"
          >
            <span class="md-mark">
              <span class="show">
                [
              </span>
            </span>
            <span class="show">
              docs
            </span>
          </a>
          <span class="md-mark">
            <span class="show">
              ](
            </span>
          </span>
          <span class="md-link-uri">
            <span class="show">
              http://x.test
            </span>
          </span>
          <span class="md-mark">
            <span class="show">
              )
            </span>
          </span>
        </span>
      </p>
      "
    `)
  })

  it('reveals nothing when the cursor is inside a bare autolink', () => {
    expect(renderHTML('focus', 'visit https://exa<a>mple.com now')).toMatchInlineSnapshot(`
      "
      <p>
        visit
        <a
          class="md-link"
          href="https://example.com"
        >
          https://example.com
        </a>
        now
      </p>
      "
    `)
  })

  it('reveals the angle brackets when the cursor is inside <url>', () => {
    expect(renderHTML('focus', 'a <https://<a>example.com> b')).toMatchInlineSnapshot(`
      "
      <p>
        a
        <span
          class="md-pack"
          data-key="autolink"
        >
          <span class="md-mark">
            <span class="show">
              &lt;
            </span>
          </span>
          <a
            class="md-link"
            href="https://example.com"
          >
            <span class="show">
              https://example.com
            </span>
          </a>
          <span class="md-mark">
            <span class="show">
              &gt;
            </span>
          </span>
        </span>
        b
      </p>
      "
    `)
  })

  it('reveals when the cursor sits right after the closing **', () => {
    expect(renderHTML('focus', '**bold**<a> rest')).toMatchInlineSnapshot(`
      "
      <p>
        <span
          class="md-pack"
          data-key="bold"
        >
          <strong>
            <span class="md-mark">
              <span class="show">
                **
              </span>
            </span>
            <span class="show">
              bold
            </span>
            <span class="md-mark">
              <span class="show">
                **
              </span>
            </span>
          </strong>
        </span>
        rest
      </p>
      "
    `)
  })

  it('reveals nothing on a multi-char selection', () => {
    expect(renderHTML('focus', '**<a>bold<b>**')).toMatchInlineSnapshot(`
      "
      <p>
        <span
          class="md-pack"
          data-key="bold"
        >
          <strong>
            <span class="md-mark">
              **
            </span>
            bold
            <span class="md-mark">
              **
            </span>
          </strong>
        </span>
      </p>
      "
    `)
  })

  it('reveals nothing inside a wikilink (the source is one atom, never revealed)', () => {
    expect(renderHTML('focus', 'see [[no<a>te]] end')).toMatchInlineSnapshot(`
      "
      <p>
        see
        <span class="md-wikilink-view md-atom-view">
          <span
            class="md-wikilink-view-preview md-atom-view-preview"
            contenteditable="false"
            data-testid="wikilink"
          >
            <span
              class="md-wikilink-view-label"
              contenteditable="false"
            >
              note
            </span>
          </span>
          <span class="md-wikilink-view-content md-atom-view-content">
            [[note]]
          </span>
        </span>
        end
      </p>
      "
    `)
  })

  it('reveals nothing inside a wikilink next to a markdown link', () => {
    expect(renderHTML('focus', '[a](http://x)[[no<a>te]]')).toMatchInlineSnapshot(`
      "
      <p>
        <span
          class="md-pack"
          data-key="link"
        >
          <a
            class="md-link"
            href="http://x"
          >
            <span class="md-mark">
              [
            </span>
            a
          </a>
          <span class="md-mark">
            ](
          </span>
          <span class="md-link-uri">
            http://x
          </span>
          <span class="md-mark">
            )
          </span>
        </span>
        <span class="md-wikilink-view md-atom-view">
          <span
            class="md-wikilink-view-preview md-atom-view-preview"
            contenteditable="false"
            data-testid="wikilink"
          >
            <span
              class="md-wikilink-view-label"
              contenteditable="false"
            >
              note
            </span>
          </span>
          <span class="md-wikilink-view-content md-atom-view-content">
            [[note]]
          </span>
        </span>
      </p>
      "
    `)
  })

  it('reveals nothing inside a #tag (tags have no syntax to reveal)', () => {
    expect(renderHTML('focus', 'Hello #me<a>ow end')).toMatchInlineSnapshot(`
      "
      <p>
        Hello
        <span class="md-tag">
          #meow
        </span>
        end
      </p>
      "
    `)
  })

  it('reveals the whole link when the cursor sits right after the closing )', () => {
    expect(renderHTML('focus', 'ABC[link](https://example.com)<a>DEF')).toMatchInlineSnapshot(`
      "
      <p>
        ABC
        <span
          class="md-pack"
          data-key="link"
        >
          <a
            class="md-link"
            href="https://example.com"
          >
            <span class="md-mark">
              <span class="show">
                [
              </span>
            </span>
            <span class="show">
              link
            </span>
          </a>
          <span class="md-mark">
            <span class="show">
              ](
            </span>
          </span>
          <span class="md-link-uri">
            <span class="show">
              https://example.com
            </span>
          </span>
          <span class="md-mark">
            <span class="show">
              )
            </span>
          </span>
        </span>
        DEF
      </p>
      "
    `)
  })

  it('reveals the angle autolink when the cursor sits right after the closing >', () => {
    expect(renderHTML('focus', 'a <https://example.com><a> b')).toMatchInlineSnapshot(`
      "
      <p>
        a
        <span
          class="md-pack"
          data-key="autolink"
        >
          <span class="md-mark">
            <span class="show">
              &lt;
            </span>
          </span>
          <a
            class="md-link"
            href="https://example.com"
          >
            <span class="show">
              https://example.com
            </span>
          </a>
          <span class="md-mark">
            <span class="show">
              &gt;
            </span>
          </span>
        </span>
        b
      </p>
      "
    `)
  })

  it('reveals the whole outer unit even when the cursor is in its bold-only region', () => {
    expect(renderHTML('focus', '**bo<a>ld *italic* bold**')).toMatchInlineSnapshot(`
      "
      <p>
        <span
          class="md-pack"
          data-key="bold"
        >
          <strong>
            <span class="md-mark">
              <span class="show">
                **
              </span>
            </span>
            <span class="show">
              bold
            </span>
          </strong>
          <span
            class="md-pack"
            data-key="italic"
          >
            <strong>
              <em>
                <span class="md-mark">
                  <span class="show">
                    *
                  </span>
                </span>
                <span class="show">
                  italic
                </span>
                <span class="md-mark">
                  <span class="show">
                    *
                  </span>
                </span>
              </em>
            </strong>
          </span>
          <strong>
            <span class="show">
              bold
            </span>
            <span class="md-mark">
              <span class="show">
                **
              </span>
            </span>
          </strong>
        </span>
      </p>
      "
    `)
  })

  it('reveals only the link the cursor is in, not its adjacent neighbor', () => {
    expect(renderHTML('focus', '[a<a>](x)[b](y)')).toMatchInlineSnapshot(`
      "
      <p>
        <span
          class="md-pack"
          data-key="link"
        >
          <a
            class="md-link"
            href="x"
          >
            <span class="md-mark">
              <span class="show">
                [
              </span>
            </span>
            <span class="show">
              a
            </span>
          </a>
          <span class="md-mark">
            <span class="show">
              ](
            </span>
          </span>
          <span class="md-link-uri">
            <span class="show">
              x
            </span>
          </span>
          <span class="md-mark">
            <span class="show">
              )
            </span>
          </span>
        </span>
        <span
          class="md-pack"
          data-key="link"
        >
          <a
            class="md-link"
            href="y"
          >
            <span class="md-mark">
              [
            </span>
            b
          </a>
          <span class="md-mark">
            ](
          </span>
          <span class="md-link-uri">
            y
          </span>
          <span class="md-mark">
            )
          </span>
        </span>
      </p>
      "
    `)
  })

  it('reveals nothing when the cursor is inside a code block', () => {
    using fixture = setupFixture()
    fixture.editor.use(defineMarkMode('focus'))
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: '' }, '*not<a> italic*')))
    expect(fixture.htmlSnapshot).toMatchInlineSnapshot(`
      "
      <pre>
        <code>
          *not italic*
        </code>
      </pre>
      "
    `)
  })

  it('renders an inline image as an atomic mark view, source kept in its content', () => {
    using fixture = setupFixture()
    fixture.editor.use(defineImage({ resolveImageUrl: () => 'http://x/p.png' }))
    fixture.editor.use(defineMarkMode('focus'))
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('![alt](pic.png)')))
    expect(fixture.htmlSnapshot).toMatchInlineSnapshot(`
      "
      <p>
        <span class="md-image-view md-atom-view">
          <span
            class="md-image-view-preview md-atom-view-preview"
            contenteditable="false"
            data-testid="image-preview"
          >
            <prosekit-resizable-root
              class="md-image-resizable"
              data-loading
              data-testid="image-resizable"
              style="width: auto; height: auto;"
            >
              <img
                alt="alt"
                draggable="false"
                src="http://x/p.png"
              >
              <prosekit-resizable-handle
                class="md-image-resize-handle"
                position="bottom-right"
              >
              </prosekit-resizable-handle>
            </prosekit-resizable-root>
          </span>
          <span class="md-image-view-content md-atom-view-content">
            ![alt](pic.png)
          </span>
        </span>
      </p>
      "
    `)
  })

  it('updates the reveal as the cursor moves between paragraphs', () => {
    using fixture = setupFixture()
    fixture.editor.use(defineMarkMode('focus'))
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('**<a>alpha** one'), n.paragraph('beta two')))
    expect(fixture.htmlSnapshot).toMatchInlineSnapshot(`
      "
      <p>
        <span
          class="md-pack"
          data-key="bold"
        >
          <strong>
            <span class="md-mark">
              <span class="show">
                **
              </span>
            </span>
            <span class="show">
              alpha
            </span>
            <span class="md-mark">
              <span class="show">
                **
              </span>
            </span>
          </strong>
        </span>
        one
      </p>
      <p>
        beta two
      </p>
      "
    `)

    const twoPos = findText(fixture.doc, 'two')
    fixture.view.dispatch(fixture.state.tr.setSelection(TextSelection.create(fixture.doc, twoPos)))
    expect(fixture.htmlSnapshot).toMatchInlineSnapshot(`
      "
      <p>
        <span
          class="md-pack"
          data-key="bold"
        >
          <strong>
            <span class="md-mark">
              **
            </span>
            alpha
            <span class="md-mark">
              **
            </span>
          </strong>
        </span>
        one
      </p>
      <p>
        beta two
      </p>
      "
    `)
  })

  it('strips syntax from the copied text just like hide mode', () => {
    expectClipboard('focus', 'Hello **bold** end', 'Hello bold end')
  })

  it.skipIf(
    // TODO: this test fails in Firefox.
    isFirefox(),
  )('handles backspace correctly around bold', async () => {
    using fixture = setupFixture()
    fixture.editor.use(defineMarkMode('focus'))
    const { n } = fixture
    // Caret sits between the space after `**bold**` and the `*italic*`.
    fixture.set(n.doc(n.paragraph('text **bold** <a>*italic* text')))
    fixture.view.focus()

    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"text **bold** ┃*italic* text"`)
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"text **bold**┃*italic* text"`)
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"text **bold*┃*italic* text"`)
  })
})

describe('hide mode', () => {
  it("sets data-mark-mode attribute to 'hide'", async () => {
    using fixture = setupFixture()
    fixture.editor.use(defineMarkMode('hide'))
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'hide')
  })

  it('never reveals markers, even with the cursor inside bold', () => {
    expect(renderHTML('hide', 'Hello **<a>bold** end')).toMatchInlineSnapshot(`
      "
      <p>
        Hello
        <span
          class="md-pack"
          data-key="bold"
        >
          <strong>
            <span class="md-mark">
              **
            </span>
            bold
            <span class="md-mark">
              **
            </span>
          </strong>
        </span>
        end
      </p>
      "
    `)
  })

  it('never reveals markers with the cursor inside a wikilink', () => {
    expect(renderHTML('hide', 'see [[no<a>te]] end')).toMatchInlineSnapshot(`
      "
      <p>
        see
        <span class="md-wikilink-view md-atom-view">
          <span
            class="md-wikilink-view-preview md-atom-view-preview"
            contenteditable="false"
            data-testid="wikilink"
          >
            <span
              class="md-wikilink-view-label"
              contenteditable="false"
            >
              note
            </span>
          </span>
          <span class="md-wikilink-view-content md-atom-view-content">
            [[note]]
          </span>
        </span>
        end
      </p>
      "
    `)
  })

  it('strips ** from the copied text', () => {
    expectClipboard('hide', 'Hello **bold** end', 'Hello bold end')
  })

  it('strips link [..](..) syntax from the copied text', () => {
    expectClipboard('hide', 'see [docs](http://x.test)', 'see docs')
  })

  it('keeps a bare autolink in the copied text', () => {
    expectClipboard('hide', 'visit https://example.com now', 'visit https://example.com now')
  })

  it('keeps the whole image source so a copied image stays markdown', () => {
    expectClipboard(
      'hide',
      'see ![cat](https://example.com/cat.png) end',
      'see ![cat](https://example.com/cat.png) end',
    )
  })

  it('keeps the whole [[ ]] source in the copied text', () => {
    expectClipboard('hide', 'see [[note]] end', 'see [[note]] end')
  })

  it('keeps #tag verbatim in the copied text', () => {
    expectClipboard('hide', 'Hello #meow end', 'Hello #meow end')
  })

  it.skipIf(
    // TODO: this test fails in Firefox.
    isFirefox(),
  )('handles backspace correctly around bold', async () => {
    using fixture = setupFixture()
    fixture.editor.use(defineMarkMode('hide'))
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('text **bold** <a>text')))
    fixture.view.focus()

    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"text **bold** ┃text"`)
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"text **bold**┃text"`)
    // Deleting into the hidden ** dissolves the whole unit: both marker runs
    // go, the content stays.
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"text bold┃text"`)
    await userEvent.keyboard('{Backspace}')
    expect(fixture.selectionSnapshot).toMatchInlineSnapshot(`"text bol┃text"`)
  })
})

describe('show mode', () => {
  it("sets data-mark-mode attribute to 'show'", async () => {
    using fixture = setupFixture()
    fixture.editor.use(defineMarkMode('show'))
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'show')
  })

  it('never reveals markers (syntax is always visible via CSS, not decorations)', () => {
    expect(renderHTML('show', 'Hello **<a>bold** end')).toMatchInlineSnapshot(`
      "
      <p>
        Hello
        <span
          class="md-pack"
          data-key="bold"
        >
          <strong>
            <span class="md-mark">
              **
            </span>
            bold
            <span class="md-mark">
              **
            </span>
          </strong>
        </span>
        end
      </p>
      "
    `)
  })

  it('installs no clipboard serializer, so copied text keeps the ** syntax', () => {
    expectClipboard('show', 'Hello **bold** end', null)
  })
})
