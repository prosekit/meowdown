import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

import { Editor } from './editor.tsx'

describe('Editor', () => {
  it('mounts a ProseMirror editor with the default content', async () => {
    const screen = await render(<Editor initialContent="Hello World!" />)
    await expect.element(screen.getByText('Hello World!')).toBeInTheDocument()
  })
})
