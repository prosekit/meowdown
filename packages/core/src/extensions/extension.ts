import {
  defineBaseCommands,
  defineBaseKeymap,
  defineHistory,
  union,
  type Editor,
} from '@prosekit/core'
import { defineBlockquote } from '@prosekit/extensions/blockquote'
import { defineDoc } from '@prosekit/extensions/doc'
import { defineGapCursor } from '@prosekit/extensions/gap-cursor'
import { defineModClickPrevention } from '@prosekit/extensions/mod-click-prevention'
import { definePlaceholder } from '@prosekit/extensions/placeholder'
import { defineText } from '@prosekit/extensions/text'
import { defineVirtualSelection } from '@prosekit/extensions/virtual-selection'

import { defineAtomMarkNavigation } from './atom-mark-navigation.ts'
import { defineBulletAfterHeading } from './bullet-after-heading.ts'
import { defineClipboard } from './clipboard/clipboard.ts'
import { defineCodeBlockSyntaxHighlight } from './code-block-highlight.ts'
import { defineCodeBlock } from './code-block.ts'
import { defineEditorCommands } from './commands.ts'
import { defineCrossEditorDrag } from './cross-editor-drag.ts'
import { defineEditorConfig, getEditorConfig, type EditorConfig } from './editor-config.ts'
import { defineEditorConfigEvents } from './editor-config-events.ts'
import { defineEmbedPaste } from './embed-paste.ts'
import { defineEscapeCollapse } from './escape-collapse.ts'
import { defineExitBoundaryHandler } from './exit-boundary.ts'
import { defineFileClickHandler } from './file-click.ts'
import { defineFilePaste } from './file-paste.ts'
import { defineFind } from './find.ts'
import { defineFollowLinkHandler } from './follow-link.ts'
import { defineDocFrontmatterAttr } from './frontmatter.ts'
import { defineHeading } from './heading.ts'
import { defineHiddenRunCaret } from './hidden-run-caret.ts'
import { defineMeowdownHorizontalRule } from './horizontal-rule.ts'
import { defineHTMLComment } from './html-comment.ts'
import { defineImageClickHandler } from './image-click.ts'
import { defineInlineMarkPlugin } from './inline-mark-plugin.ts'
import { defineInlineMarks } from './inline-marks.ts'
import { defineInlineToggle } from './inline-toggle-commands.ts'
import { defineLinkClickHandler } from './link-click.ts'
import { defineLinkCommands } from './link-commands.ts'
import { defineLinkPaste } from './link-paste.ts'
import { defineMeowdownList } from './list.ts'
import { defineMarkMode } from './mark-mode.ts'
import { ATOM_SOURCE_MARK_NAMES } from './mark-names.ts'
import { defineMath } from './math.ts'
import { defineMoveBlock } from './move-block.ts'
import { defineMeowdownParagraph } from './paragraph.ts'
import { definePendingReplacement } from './pending-replacement.ts'
import { defineReadonly } from './readonly.ts'
import { defineScrollToSelection } from './scroll-to-selection.ts'
import { defineSelectDocBoundary } from './select-doc-boundary.ts'
import { defineSoftBreak } from './soft-break.ts'
import { defineSubstitution } from './substitution.ts'
import { defineSystemSubstitutionGuard } from './system-substitution-guard.ts'
import { defineTable } from './table.ts'
import { defineTagClickHandler } from './tag-click.ts'
import { defineViewAttributes } from './view-attributes.ts'
import { defineWikilinkClickHandler } from './wikilink-click.ts'
import { defineWikilinkTrigger } from './wikilink-trigger.ts'
import { defineWikilink } from './wikilink.ts'

function defineEditorExtensionImpl(options: EditorExtensionOptions) {
  return union(
    // nodes
    defineMeowdownParagraph(),
    defineDoc(),
    defineDocFrontmatterAttr(),
    defineText(),
    defineBlockquote(),
    defineMeowdownList(),
    defineHeading(),
    defineTable(),
    defineCodeBlock(),
    defineMeowdownHorizontalRule(),
    defineHTMLComment(),

    // marks
    defineInlineMarks(),

    // plugins
    defineEditorConfig(options),
    defineEditorConfigEvents(),
    defineFileClickHandler((state) => getEditorConfig(state).onFileClick),
    defineImageClickHandler((state) => getEditorConfig(state).onImageClick),
    defineWikilinkClickHandler((state) => getEditorConfig(state).onWikilinkClick),
    defineTagClickHandler((state) => getEditorConfig(state).onTagClick),
    defineLinkClickHandler((state) => getEditorConfig(state).onLinkClick),
    defineFollowLinkHandler(getEditorConfig),
    defineExitBoundaryHandler((state) => getEditorConfig(state).onExitBoundary),
    defineFilePaste(),
    defineEmbedPaste((state) => !!getEditorConfig(state).embedPaste),
    defineLinkPaste((state) => !!getEditorConfig(state).linkPaste),
    defineBulletAfterHeading((state) => !!getEditorConfig(state).bulletAfterHeading),
    defineSubstitution((state) => !!getEditorConfig(state).substitution),
    defineWikilinkTrigger((state) => !!getEditorConfig(state).wikilinkEnabled),
    definePlaceholder({
      placeholder: (state) => {
        const placeholder = getEditorConfig(state).placeholder
        return typeof placeholder === 'function' ? placeholder(state) : (placeholder ?? '')
      },
      strategy: 'doc',
    }),
    defineReadonly((state) => !!getEditorConfig(state).readOnly),
    defineViewAttributes((state) => {
      const { editorClassName, spellCheck } = getEditorConfig(state)
      const attributes: Record<string, string> = { class: 'meowdown-content' }
      if (editorClassName) attributes.class += ` ${editorClassName}`
      if (spellCheck != null) attributes.spellcheck = String(spellCheck)
      return attributes
    }),
    defineCodeBlockSyntaxHighlight(),
    defineCrossEditorDrag(),
    defineEscapeCollapse(),
    defineSoftBreak(),
    defineMoveBlock(),
    defineSelectDocBoundary(),
    defineInlineMarkPlugin(),
    defineInlineToggle(),
    defineLinkCommands(),
    defineWikilink(),
    defineMath(),
    defineMarkMode((state) => getEditorConfig(state).markMode ?? 'focus'),
    defineClipboard(),
    defineScrollToSelection(),
    defineHiddenRunCaret(),
    defineSystemSubstitutionGuard(),
    defineAtomMarkNavigation({
      marks: ATOM_SOURCE_MARK_NAMES.map((name) => ({ name, modes: ['hide', 'focus', 'show'] })),
    }),

    // others
    defineBaseKeymap(),
    defineBaseCommands(),
    defineHistory(),
    defineGapCursor(),
    defineVirtualSelection(),
    defineModClickPrevention(),
    defineEditorCommands(),
    definePendingReplacement(),
    defineFind(),
  )
}

export type EditorExtension = ReturnType<typeof defineEditorExtensionImpl>

/**
 * Initial configuration, replaceable with `replaceEditorConfig`.
 */
export type EditorExtensionOptions = EditorConfig

export function defineEditorExtension(options: EditorExtensionOptions = {}): EditorExtension {
  return defineEditorExtensionImpl(options)
}

export type TypedEditor = Editor<EditorExtension>
