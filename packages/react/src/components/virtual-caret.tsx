import { defineVirtualCaret } from '@meowdown/core'
import { useExtension } from '@prosekit/react'
import { useMemo, useState, type ReactElement } from 'react'

// A leaf that owns the caret layer: React renders the div and the extension
// draws into it. `useExtension` reads the editor from context.
export function VirtualCaret(): ReactElement {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  useExtension(useMemo(() => (layer == null ? null : defineVirtualCaret(layer)), [layer]))
  return <div ref={setLayer}></div>
}
