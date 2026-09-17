import { describe, expect, it } from 'vitest'

import { markdownToDoc } from '../converters/md-to-pm.ts'
import { setupFixture } from '../testing/index.ts'

import { collectPostEmbeds, type PostEmbedReference } from './collect-post-embeds.ts'

const POST = 'https://x.com/jack/status/20'
const OTHER_POST = 'https://twitter.com/jack/status/21'
const VIDEO = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
const LAST_POST = 'https://x.com/jack/status/99'

describe('collectPostEmbeds', () => {
  // The cards a mounted editor asks its resolvers for, in the order it asks.
  // A trailing card marks the end of rendering.
  async function getRenderedEmbeds(
    markdown: string,
    frontmatter = false,
  ): Promise<PostEmbedReference[]> {
    const embeds: PostEmbedReference[] = []
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
    fixture.set(markdownToDoc(`${markdown}\n\n![](${LAST_POST})`, { nodes: n, frontmatter }))
    await expect.poll(() => embeds.at(-1)?.url).toBe(LAST_POST)
    return embeds
  }

  async function expectEmbeds(
    markdown: string,
    expected: PostEmbedReference[],
    frontmatter = false,
  ): Promise<void> {
    const collected = collectPostEmbeds(`${markdown}\n\n![](${LAST_POST})`, { frontmatter })
    const last: PostEmbedReference = { kind: 'x-post', url: LAST_POST }
    expect(collected).toEqual([...expected, last])
    expect(await getRenderedEmbeds(markdown, frontmatter)).toEqual(collected)
  }

  it('collects inline X posts and YouTube videos', async () => {
    await expectEmbeds(`![](${POST}) and ![](${VIDEO})`, [
      { kind: 'x-post', url: POST },
      { kind: 'youtube-video', url: VIDEO },
    ])
  })

  it('skips plain images', async () => {
    await expectEmbeds('![](https://example.com/cat.png)', [])
  })

  it('collects posts nested in quotes, lists, headings, tables, and links', async () => {
    await expectEmbeds(
      [
        `> - ![](${POST})`,
        `# ![](${OTHER_POST})`,
        '| x |\n| - |\n| ![](' + POST + ') |',
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

  it('resolves full, collapsed, and shortcut reference images', async () => {
    await expectEmbeds(
      [`![alt][Post]`, `![post][]`, `![post]`, `[post]: <${POST}> "title"`].join('\n\n'),
      [
        { kind: 'x-post', url: POST },
        { kind: 'x-post', url: POST },
        { kind: 'x-post', url: POST },
      ],
    )
  })

  it('uses the first definition of a reference label', async () => {
    await expectEmbeds(`![alt][post]\n\n[post]: ${POST}\n[post]: ${OTHER_POST}`, [
      { kind: 'x-post', url: POST },
    ])
  })

  it('skips references without a definition', async () => {
    await expectEmbeds('![alt][missing]', [])
  })

  it('skips code blocks and HTML comments', async () => {
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

  it('collects posts inside HTML blocks', async () => {
    await expectEmbeds(`<div>\n![](${POST})\n</div>`, [{ kind: 'x-post', url: POST }])
  })

  it('collects only the outer image when an image label holds another image', async () => {
    await expectEmbeds(`![![](${OTHER_POST})](${POST})`, [{ kind: 'x-post', url: POST }])
  })

  it('skips posts inside frontmatter when the editor peels it', async () => {
    await expectEmbeds(
      `---\ncover: ![](${OTHER_POST})\n---\n![](${POST})`,
      [{ kind: 'x-post', url: POST }],
      true,
    )
  })
})
