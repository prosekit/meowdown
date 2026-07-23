import { writeClipboard } from '@meowdown/vitest/clipboard'
import { pasteText } from '@prosekit/core/test'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { docToMarkdown } from '../../converters/pm-to-md.ts'
import { setupFixture, type Fixture } from '../../testing/index.ts'

async function pastePlain(fixture: Fixture, text: string): Promise<void> {
  await writeClipboard({ 'text/plain': text })
  fixture.view.focus()
  await userEvent.paste()
}

async function pastePlainText(text: string): Promise<string> {
  using fixture = setupFixture()
  const { n, view } = fixture
  fixture.set(n.doc(n.paragraph()))
  await pastePlain(fixture, text)
  return docToMarkdown(view.state.doc)
}

describe('plain text paste', () => {
  it('inserts a single line inline', async () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph('before <a>after')))
    await pastePlain(fixture, 'pasted')
    expect(docToMarkdown(view.state.doc)).toMatchInlineSnapshot(`
      """
      before pastedafter

      """
    `)
  })

  it('keeps a single newline as a soft break', async () => {
    expect(await pastePlainText('aaa\nbbb')).toMatchInlineSnapshot(`
      """
      aaa
      bbb

      """
    `)
  })

  it('does not insert an empty paragraph for one blank line', async () => {
    expect(await pastePlainText('aaa\n\nbbb')).toMatchInlineSnapshot(`
      """
      aaa

      bbb

      """
    `)
  })

  it('restores one gap paragraph for two blank lines', async () => {
    expect(await pastePlainText('aaa\n\n\nbbb')).toMatchInlineSnapshot(`
      """
      aaa


      bbb

      """
    `)
  })

  it('trims leading and trailing newlines', async () => {
    expect(await pastePlainText('\n\naaa\n\n')).toMatchInlineSnapshot(`
      """
      aaa

      """
    `)
  })

  it('inserts nothing for whitespace-only newlines', async () => {
    expect(await pastePlainText('\n\n\n')).toMatchInlineSnapshot(`
      "
      "
    `)
  })

  it('normalizes CRLF', async () => {
    expect(await pastePlainText('aaa\r\n\r\nbbb\r\nccc')).toMatchInlineSnapshot(`
      """
      aaa

      bbb
      ccc

      """
    `)
  })

  it('keeps tabs and spaces', async () => {
    expect(await pastePlainText('a\t b')).toMatchInlineSnapshot(`
      """
      a	 b

      """
    `)
  })

  it('renders pasted inline markdown source immediately', async () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph()))
    await pastePlain(fixture, 'a **b** c')
    expect(docToMarkdown(view.state.doc)).toMatchInlineSnapshot(`
      """
      a **b** c

      """
    `)
    expect(fixture.htmlSnapshot).toMatchInlineSnapshot(`
      "
      <p>
        a
        <span
          class="md-pack"
          data-key="bold"
        >
          <strong>
            <span class="md-mark">
              **
            </span>
            b
            <span class="md-mark">
              **
            </span>
          </strong>
        </span>
        c
      </p>
      "
    `)
  })

  it('parses block markdown syntax into blocks', async () => {
    expect(await pastePlainText('# title\ntext')).toMatchInlineSnapshot(`
      """
      # title

      text

      """
    `)
  })

  it('parses pasted task lists', async () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph()))
    await pastePlain(fixture, '- [ ] one\n- [x] two')
    expect(docToMarkdown(view.state.doc)).toMatchInlineSnapshot(`
      """
      - [ ] one
      - [x] two

      """
    `)
    expect(view.state.doc.firstChild?.type.name).toBe('list')
    expect(view.state.doc.firstChild?.attrs.kind).toBe('task')
  })

  it('parses pasted fenced code blocks', async () => {
    expect(await pastePlainText('```js\nconst a = 1\n```')).toMatchInlineSnapshot(`
      """
      \`\`\`js
      const a = 1
      \`\`\`

      """
    `)
  })
})

describe('plain text paste with shift', () => {
  // `pasteText` sets ProseMirror's plain-text flag, the same path a
  // Shift-paste takes: every newline run becomes a paragraph break.
  it('splits every newline run into paragraphs', () => {
    using fixture = setupFixture()
    const { n, view } = fixture
    fixture.set(n.doc(n.paragraph()))
    pasteText(view, 'aaa\nbbb\n\nccc')
    expect(docToMarkdown(view.state.doc)).toMatchInlineSnapshot(`
      """
      aaa

      bbb

      ccc

      """
    `)
  })
})
