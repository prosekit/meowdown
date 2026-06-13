import { formatHTML } from 'diffable-html-snapshot'
import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

describe('defineCodeBlockSyntaxHighlight', () => {
  it('renders syntax token spans for a code block', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: 'js' }, 'const answer = 42')))
    const selector = '.ProseMirror pre code [class*="tok-"]'
    const locator = page.locate(selector).first()
    await expect.element(locator, { timeout: 15000 }).toBeInTheDocument()
    expect(formatHTML(fixture.dom.innerHTML)).toMatchInlineSnapshot(`
      "
      <pre data-language="js">
        <code class="language-js">
          <span class="tok-keyword">
            const
          </span>
          <span class="tok-variableName tok-definition">
            answer
          </span>
          <span class="tok-operator">
            =
          </span>
          <span class="tok-number">
            42
          </span>
        </code>
      </pre>
      "
    `)
  })

  it('does not crash on an unknown language and leaves the text intact', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: 'definitely-not-a-language' }, 'plain text here')))
    await expect.element(page.locate('#test-container pre')).toHaveTextContent('plain text here')
  })
})
