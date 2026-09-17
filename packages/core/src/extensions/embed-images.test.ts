import { collectImages, matchEmbed, type EmbedKind } from '@meowdown/markdown'
import { describe, expect, it } from 'vitest'

import { markdownToDoc } from '../converters/md-to-pm.ts'
import { setupFixture } from '../testing/index.ts'

const POST = 'https://x.com/jack/status/20'
const OTHER_POST = 'https://twitter.com/jack/status/21'
const VIDEO = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
const LAST_POST = 'https://x.com/jack/status/99'

interface Embed {
  kind: EmbedKind
  url: string
}

// FIXME: remove this test file
// FIXME: merge the latest origin/master into this branch

describe('collectImages with matchEmbed', () => {
  // The cards a mounted editor asks its resolvers for, in the order it asks.
  // A trailing card marks the end of rendering.
  async function getRenderedEmbeds(markdown: string): Promise<Embed[]> {
    const embeds: Embed[] = []
    using fixture = setupFixture({
      extensionOptions: {
        resolveXPost: (url) => {
          embeds.push({ kind: 'x-post', url })
          return
        },
        resolveYouTubeVideo: (url) => {
          embeds.push({ kind: 'youtube-video', url })
          return
        },
      },
    })
    const { n } = fixture
    fixture.set(markdownToDoc(markdown, { nodes: n }))
    await expect.poll(() => embeds.at(-1)?.url).toBe(LAST_POST)
    return embeds
  }

  async function expectEmbeds(markdown: string, expected: Embed[]): Promise<void> {
    const document = `${markdown}\n\n![](${LAST_POST})`
    const collected = collectImages(document).flatMap((url) => {
      const kind = matchEmbed(url)
      return kind == null ? [] : [{ kind, url }]
    })
    expect(collected).toEqual([...expected, { kind: 'x-post', url: LAST_POST }])
    expect(await getRenderedEmbeds(document)).toEqual(collected)
  }

  it('finds the X posts and YouTube videos the editor renders', async () => {
    await expectEmbeds(`![](${POST}) and ![](${VIDEO}) and ![](https://example.com/cat.png)`, [
      { kind: 'x-post', url: POST },
      { kind: 'youtube-video', url: VIDEO },
    ])
  })

  it('finds embeds nested in quotes, lists, headings, tables, and links', async () => {
    await expectEmbeds(
      [
        `> - ![](${POST})`,
        `# ![](${OTHER_POST})`,
        `| x |\n| - |\n| ![](${POST}) |`,
        `[![](${OTHER_POST})](https://example.com)`,
      ].join('\n\n'),
      [
        { kind: 'x-post', url: POST },
        { kind: 'x-post', url: OTHER_POST },
        { kind: 'x-post', url: POST },
        { kind: 'x-post', url: OTHER_POST },
      ],
    )
  })

  it('skips images in code blocks and HTML comments', async () => {
    await expectEmbeds(
      [
        '```',
        `![](${POST})`,
        '```',
        '',
        `    ![](${POST})`,
        '',
        '<!--',
        `![](${POST})`,
        '-->',
      ].join('\n'),
      [],
    )
  })

  it('finds only the outer image when an image label holds another image', async () => {
    await expectEmbeds(`![![](${OTHER_POST})](${POST})`, [{ kind: 'x-post', url: POST }])
  })
})
