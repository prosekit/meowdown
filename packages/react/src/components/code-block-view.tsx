import { Combobox } from '@base-ui/react/combobox'
import {
  codeBlockLanguages,
  isCodeBlockPreviewHiddenDecoration,
  type CodeBlockAttrs,
  type LanguageItem,
} from '@meowdown/core'
import { TextSelection } from '@prosekit/pm/state'
import type { ReactNodeViewProps } from '@prosekit/react'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'

import { useBeautifulMermaid } from '../hooks/use-beautiful-mermaid.ts'
import { useKaTeX } from '../hooks/use-katex.ts'

import styles from './code-block-view.module.css'
import { CopyButton } from './copy-button.tsx'
import { MathRender } from './math-render.tsx'
import { MermaidRender } from './mermaid-render.tsx'

export function CodeBlockView(props2: ReactNodeViewProps) {
  const { node, view, getPos, decorations, selected, setAttrs, contentRef } = props2

  useEffect(() => {
    console.log('node changed')
  }, [node])
  useEffect(() => {
    console.log('view changed')
  }, [view])
  useEffect(() => {
    console.log('getPos changed')
  }, [getPos])
  useEffect(() => {
    console.log('decorations changed')
  }, [decorations])
  useEffect(() => {
    console.log('selected changed')
  }, [selected])
  useEffect(() => {
    console.log('setAttrs changed')
  }, [setAttrs])
  useEffect(() => {
    console.log('contentRef changed')
  }, [contentRef])

  const attrs = node.attrs as CodeBlockAttrs
  const language = attrs.language || ''
  const isMath = language === 'math'
  const isMermaid = language === 'mermaid'
  const code = node.textContent

  const caretInside = decorations.some(isCodeBlockPreviewHiddenDecoration)

  const katex = useKaTeX(isMath)
  const mermaid = useBeautifulMermaid(isMermaid)
  const showMathPreview = isMath && katex != null
  const showMermaidPreview = isMermaid && mermaid != null

  // The preview replaces the source only when the caret is elsewhere; with the
  // caret inside, the source stays on top and the preview updates live below.
  // An empty or not-yet-rendered block keeps its source, so it never turns
  // invisible and unclickable.
  const previewOnly = (showMathPreview || showMermaidPreview) && !caretInside && code.trim() !== ''

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
    <div className={styles.Root} data-preview={previewOnly || undefined}>
      {selected ? null : (
        <CodeBlockToolbar language={language} setLanguage={setLanguage} getText={() => code} />
      )}
      <pre ref={contentRef} data-language={language}></pre>
      {showMathPreview && (
        <MathRender
          katex={katex}
          formula={code}
          displayMode
          className={styles.Preview}
          data-testid="code-block-math-preview"
          onMouseDown={focusSource}
        />
      )}
      {showMermaidPreview && (
        <MermaidRender
          renderer={mermaid}
          source={code}
          className={`${styles.Preview} ${styles.MermaidPreview}`}
          data-testid="code-block-mermaid-preview"
          onMouseDown={focusSource}
        />
      )}
    </div>
  )
}

interface CodeBlockToolbarProps {
  language: string
  setLanguage: (language: string) => void
  getText: () => string
}

function CodeBlockToolbar({ language, setLanguage, getText }: CodeBlockToolbarProps) {
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

  // Keep the toolbar shown until the popup finishes closing animation
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
        getText={getText}
        label="Copy code"
        className={styles.CopyButton}
        data-testid="code-block-copy"
      />
    </div>
  )
}
