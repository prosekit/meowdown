import { Combobox } from '@base-ui/react/combobox'
import {
  codeBlockLanguages,
  isCodeBlockPreviewHiddenDecoration,
  type CodeBlockAttrs,
  type LanguageItem,
} from '@meowdown/core'
import { Fragment } from '@prosekit/pm/model'
import { TextSelection } from '@prosekit/pm/state'
import type { ReactNodeViewProps } from '@prosekit/react'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import {
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react'

import { useBeautifulMermaid } from '../hooks/use-beautiful-mermaid.ts'
import { useKaTeX } from '../hooks/use-katex.ts'
import { NON_PROSE_PROPS } from '../utils/non-prose-props.ts'

import styles from './code-block-view.module.css'
import { CopyButton } from './copy-button.tsx'
import { MathRender } from './math-render.tsx'
import { MermaidRender } from './mermaid-render.tsx'

export interface CodeBlockRenderOptions {
  /**
   * The language written after the opening fence, or an empty string.
   */
  language: string
  /**
   * The code block body without its fences.
   */
  code: string
  /**
   * Replace the block body as one undoable editor transaction.
   */
  updateCode: (code: string) => void
}

/**
 * Return custom content for a code block, or null to use Meowdown's built-in view.
 */
export type CodeBlockRenderer = (options: CodeBlockRenderOptions) => ReactNode | null

/**
 * Props for {@link CodeBlockView}.
 */
export interface CodeBlockViewProps extends ReactNodeViewProps {
  renderCodeBlock?: CodeBlockRenderer
}

export function CodeBlockView(props: CodeBlockViewProps): ReactElement {
  const { node, view, getPos, decorations, selected, setAttrs, contentRef } = props

  const attrs = node.attrs as CodeBlockAttrs
  const language = attrs.language || ''
  const code = node.textContent

  const updateCode = useCallback(
    (nextCode: string) => {
      const pos = getPos()
      if (pos == null) return
      const currentNode = view.state.doc.nodeAt(pos)
      if (currentNode?.type !== view.state.schema.nodes.codeBlock) return
      const from = pos + 1
      const to = from + currentNode.content.size
      const content = nextCode === '' ? Fragment.empty : view.state.schema.text(nextCode)
      view.dispatch(view.state.tr.replaceWith(from, to, content))
    },
    [getPos, view],
  )

  const caretInside = decorations.some(isCodeBlockPreviewHiddenDecoration)
  const customContent = props.renderCodeBlock?.({ language, code, updateCode }) ?? null
  const hasCustomContent = customContent !== null
  const customPreviewOnly = hasCustomContent && !caretInside
  const isMath = !hasCustomContent && language === 'math'
  const isMermaid = !hasCustomContent && language === 'mermaid'

  const katex = useKaTeX(isMath)
  const mermaid = useBeautifulMermaid(isMermaid)
  const showMathPreview = isMath && katex != null
  const showMermaidPreview = isMermaid && mermaid != null
  const showPreview = showMathPreview || showMermaidPreview
  const previewCode = useDeferredValue(showPreview ? code : '')

  // The preview replaces the source only when the caret is elsewhere; with the
  // caret inside, the source stays on top and the preview updates live below.
  // An empty or not-yet-rendered block keeps its source, so it never turns
  // invisible and unclickable.
  const previewOnly = !hasCustomContent && showPreview && !caretInside && code.trim() !== ''

  const focusSource = useCallback(
    (event: MouseEvent) => {
      event.preventDefault()
      const pos = getPos()
      if (pos == null) return
      const selection = TextSelection.near(view.state.doc.resolve(pos + 1), 1)
      view.dispatch(view.state.tr.setSelection(selection))
      view.focus()
    },
    [view, getPos],
  )

  const setLanguage = useCallback(
    (language: string) => {
      setAttrs({ language } satisfies CodeBlockAttrs)
    },
    [setAttrs],
  )

  return (
    <div
      className={styles.Root}
      data-custom={customPreviewOnly || undefined}
      data-preview={previewOnly || undefined}
    >
      <pre ref={contentRef} data-language={language} {...NON_PROSE_PROPS}></pre>
      {hasCustomContent ? (
        <div
          className={styles.CustomContent}
          contentEditable={false}
          data-meowdown-code-block-custom=""
          {...NON_PROSE_PROPS}
        >
          {customContent}
        </div>
      ) : (
        /* Skip rendering the toolbar during dragging to improve the performance of rendering the drag preview image in Safari */
        !selected && <CodeBlockToolbar code={code} language={language} setLanguage={setLanguage} />
      )}
      {showMathPreview && (
        <MathRender
          katex={katex}
          formula={previewCode}
          displayMode
          className={styles.Preview}
          data-testid="code-block-math-preview"
          onMouseDown={focusSource}
        />
      )}
      {showMermaidPreview && (
        <MermaidRender
          renderer={mermaid}
          source={previewCode}
          className={`${styles.Preview} ${styles.MermaidPreview}`}
          data-testid="code-block-mermaid-preview"
          onMouseDown={focusSource}
        />
      )}
    </div>
  )
}

interface CodeBlockToolbarProps {
  code: string
  language: string
  setLanguage: (language: string) => void
}

function CodeBlockToolbar({ code, language, setLanguage }: CodeBlockToolbarProps) {
  // Fall back to the raw value so an alias or unknown language still shows in
  // the trigger instead of looking empty.
  const selected = useMemo<LanguageItem>(() => {
    return (
      codeBlockLanguages.find((item) => item.value === language) ?? {
        value: language,
        label: language,
      }
    )
  }, [language])

  const [query, setQuery] = useState('')

  // Keep the toolbar shown until the popup finishes its closing animation
  const [comboboxOpen, setComboboxOpen] = useState(false)

  // Offer the typed value as an option when it doesn't match a known one.
  const itemsForView = useMemo<readonly LanguageItem[]>(() => {
    const value = query.trim()
    if (!value) return codeBlockLanguages
    const lowercased = value.toLowerCase()
    const known = codeBlockLanguages.some(
      (item) => item.value.toLowerCase() === lowercased || item.label.toLowerCase() === lowercased,
    )
    return known ? codeBlockLanguages : [...codeBlockLanguages, { value, label: `Use "${value}"` }]
  }, [query])

  return (
    <div className={styles.Toolbar} contentEditable={false} data-open={comboboxOpen || undefined}>
      <Combobox.Root
        items={itemsForView}
        value={selected}
        onValueChange={(item) => setLanguage(item?.value ?? '')}
        inputValue={query}
        onInputValueChange={setQuery}
        onOpenChange={(open) => {
          if (open) setComboboxOpen(true)
          else setQuery('')
        }}
        onOpenChangeComplete={(open) => {
          if (!open) setComboboxOpen(false)
        }}
      >
        <Combobox.Trigger className={styles.Trigger} data-testid="code-block-language">
          <Combobox.Value placeholder="Plain Text" />
          <Combobox.Icon className={styles.TriggerIcon}>
            <ChevronsUpDownIcon />
          </Combobox.Icon>
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner className={styles.Positioner} sideOffset={4}>
            <Combobox.Popup className={styles.Popup}>
              <div className={styles.SearchRow}>
                <Combobox.Input
                  className={styles.Search}
                  placeholder="Search or type a language"
                  data-testid="code-block-language-search"
                />
              </div>
              <Combobox.Empty className={styles.Empty}>No languages found.</Combobox.Empty>
              <Combobox.List className={styles.List}>
                {(item: LanguageItem) => (
                  <Combobox.Item key={item.label} value={item} className={styles.Item}>
                    <Combobox.ItemIndicator className={styles.ItemIndicator}>
                      <CheckIcon />
                    </Combobox.ItemIndicator>
                    <span className={styles.ItemText}>{item.label}</span>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      <CopyButton
        getText={() => code}
        label="Copy code"
        className={styles.CopyButton}
        data-testid="code-block-copy"
      />
    </div>
  )
}
