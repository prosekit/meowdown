import { Select } from '@base-ui/react/select'
import type { Extension } from '@prosekit/core'
import { type CodeBlockAttrs, shikiBundledLanguagesInfo } from '@prosekit/extensions/code-block'
import {
  defineReactNodeView,
  type ReactNodeViewComponent,
  type ReactNodeViewProps,
} from '@prosekit/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import styles from './code-block-view.module.css'
import { CheckIcon } from './icons/check-icon.tsx'
import { ChevronsUpDownIcon } from './icons/chevrons-up-down-icon.tsx'
import { CopyIcon } from './icons/copy-icon.tsx'

const PLAIN_TEXT = ''
const PLAIN_TEXT_LABEL = 'Plain Text'
const COPIED_RESET_MS = 1500

function CodeBlockView(props: ReactNodeViewProps) {
  const language = (props.node.attrs as CodeBlockAttrs).language || PLAIN_TEXT

  // `items` lets `<Select.Value>` show the label of the selected language.
  const items = useMemo<Record<string, string>>(() => {
    const record: Record<string, string> = { [PLAIN_TEXT]: PLAIN_TEXT_LABEL }
    for (const info of shikiBundledLanguagesInfo) {
      record[info.id] = info.name
    }
    return record
  }, [])

  const setLanguage = (value: string) => {
    props.setAttrs({ language: value } satisfies CodeBlockAttrs)
  }

  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(resetTimer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.node.textContent)
      setCopied(true)
      clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS)
    } catch {
      // The clipboard API can reject (no permission, insecure context); ignore.
    }
  }

  return (
    <div className={styles.Root}>
      <div className={styles.Toolbar} contentEditable={false}>
        <Select.Root items={items} value={language} onValueChange={setLanguage} modal={false}>
          <Select.Trigger className={styles.Trigger} data-testid="code-block-language">
            <Select.Value />
            <Select.Icon className={styles.TriggerIcon}>
              <ChevronsUpDownIcon />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner
              className={styles.Positioner}
              sideOffset={4}
              alignItemWithTrigger={false}
            >
              <Select.Popup className={styles.Popup}>
                <Select.List className={styles.List}>
                  {Object.entries(items).map(([value, label]) => (
                    <Select.Item
                      key={value || PLAIN_TEXT_LABEL}
                      value={value}
                      className={styles.Item}
                    >
                      <Select.ItemIndicator className={styles.ItemIndicator}>
                        <CheckIcon />
                      </Select.ItemIndicator>
                      <Select.ItemText className={styles.ItemText}>{label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
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
      <pre
        ref={props.contentRef}
        className={styles.Pre}
        data-language={language || undefined}
      ></pre>
    </div>
  )
}

export function defineCodeBlockView(): Extension {
  return defineReactNodeView({
    name: 'codeBlock',
    contentAs: 'code',
    component: CodeBlockView satisfies ReactNodeViewComponent,
  })
}
