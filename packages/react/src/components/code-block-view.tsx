import { Combobox } from '@base-ui/react/combobox'
import { type CodeBlockAttrs, codeBlockLanguages } from '@meowdown/core'
import type { ReactNodeViewProps } from '@prosekit/react'
import { useMemo, useRef, useState } from 'react'

import styles from './code-block-view.module.css'
import { CheckIcon } from './icons/check-icon.tsx'
import { ChevronsUpDownIcon } from './icons/chevrons-up-down-icon.tsx'
import { CopyIcon } from './icons/copy-icon.tsx'

type LanguageItem = {
  label: string
  value: string
}

const COPIED_RESET_MS = 1500

export function CodeBlockView(props: ReactNodeViewProps) {
  const attrs = props.node.attrs as CodeBlockAttrs
  const language = attrs.language || ''

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

  const setLanguage = (item: LanguageItem | null) => {
    props.setAttrs({ language: item?.value ?? '' } satisfies CodeBlockAttrs)
  }

  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.node.textContent)
      setCopied(true)
      clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS)
    } catch (error) {
      console.warn('[meowdown] Failed to copy code block:', error)
    }
  }

  return (
    <div className={styles.Root}>
      <div className={styles.Toolbar} contentEditable={false} data-open={comboboxOpen || undefined}>
        <Combobox.Root
          items={itemsForView}
          value={selected}
          onValueChange={setLanguage}
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
        <button
          type="button"
          className={styles.CopyButton}
          data-testid="code-block-copy"
          data-copied={copied ? '' : undefined}
          aria-label={copied ? 'Copied' : 'Copy code'}
          title={copied ? 'Copied' : 'Copy code'}
          onMouseDown={(event) => event.preventDefault()}
          onClick={copy}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
      <pre ref={props.contentRef} data-language={language}></pre>
    </div>
  )
}
