import DOMPurify from 'dompurify'

// Tags that never belong in a note preview. Scripts and event handlers are
// already stripped by DOMPurify's defaults; these are the extras a notes app
// does not want to render: embeds that load remote content or run scripts, and
// interactive form controls that would swallow clicks. Listed explicitly so the
// policy survives a DOMPurify default change.
const FORBID_TAGS = [
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'select',
  'option',
  'textarea',
]

/**
 * Sanitize a raw HTML block's source into a `DocumentFragment` safe to insert
 * into the editor. The `style` attribute is kept (a real notes need), while
 * `<script>`, event handlers, `javascript:` URLs, remote embeds, and form
 * controls are removed. The original markdown source is never touched; only
 * this rendered copy is sanitized.
 */
export function sanitizeHTMLBlock(source: string): DocumentFragment {
  return DOMPurify.sanitize(source, {
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS,
  })
}
