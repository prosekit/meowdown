import { MarkdownView, WikilinkHoverCard } from '@meowdown/react'

import { NOTE_PREVIEWS } from '../lib/demo-data.ts'

// Hover preview for wikilinks: a known note renders as a passive Markdown
// card, an unknown target renders no card at all.
export function WikilinkPreviewCard() {
  return (
    <WikilinkHoverCard>
      {(hit) => {
        const markdown = NOTE_PREVIEWS[hit.target]
        if (!markdown) return null
        return (
          <div className="meowdown px-3 py-2 text-sm [&_.meowdown-content]:p-0!">
            <MarkdownView markdown={markdown} interactive={false} />
          </div>
        )
      }}
    </WikilinkHoverCard>
  )
}
