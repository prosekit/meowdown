import '../testing/index.ts'

import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { MarkdownEditor } from '../components/editor.tsx'
import { expectScreenshots, renderVisual } from '../testing/visual.tsx'
import { createXPost } from '../testing/x-post-fixture.ts'
import { createYouTubeVideo } from '../testing/youtube-fixture.ts'

const pmRoot = page.locate('.ProseMirror')

describe('embed', () => {
  it('renders an X post', async () => {
    await renderVisual(
      <MarkdownEditor
        initialMarkdown={'An X post:\n\n![](https://x.com/jack/status/20)'}
        resolveXPost={() => createXPost()}
      />,
    )
    await expect
      .element(pmRoot.getByTestId('x-post-embed'))
      .toMatchTextContent('just setting up my twttr')
    await expectScreenshots('x-post')
  })

  it('renders a YouTube video', async () => {
    await renderVisual(
      <MarkdownEditor
        initialMarkdown={'A YouTube video:\n\n![](https://www.youtube.com/watch?v=aqz-KE-bpKQ)'}
        resolveYouTubeVideo={() => createYouTubeVideo()}
      />,
    )
    await expect
      .element(pmRoot.getByTestId('youtube-video-embed'))
      .toMatchTextContent('Big Buck Bunny')
    await expectScreenshots('youtube')
  })
})
