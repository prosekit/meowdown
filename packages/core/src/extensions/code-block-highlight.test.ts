import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

// `setupFixture` mounts the editor onto `#test-container` itself, so the
// `.ProseMirror` element *is* that container. `@lezer/highlight` tags each
// token span with a `tok-*` class.
const tokens = page.locate('#test-container pre code [class*="tok-"]')

describe('defineCodeBlockSyntaxHighlight', () => {
  it('renders syntax token spans for a code block', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: 'js' }, 'const answer = 42')))
    await expect.element(tokens.first(), { timeout: 15000 }).toBeInTheDocument()
  })

  it('does not crash on an unknown language and leaves the text intact', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.codeBlock({ language: 'definitely-not-a-language' }, 'plain text here')))
    await expect.element(page.locate('#test-container pre')).toHaveTextContent('plain text here')
  })
})
