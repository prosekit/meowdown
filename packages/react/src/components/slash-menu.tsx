import type { EditorExtension } from '@meowdown/core'
import { canUseRegexLookbehind } from '@prosekit/core'
import { useEditor } from '@prosekit/react'
import {
  AutocompleteEmpty,
  AutocompleteItem,
  AutocompletePopup,
  AutocompletePositioner,
  AutocompleteRoot,
} from '@prosekit/react/autocomplete'

// Match inputs like "/", "/table", "/heading 1" etc. Do not match "/ heading".
const regex = canUseRegexLookbehind() ? /(?<!\S)\/(\S.*)?$/u : /\/(\S.*)?$/u

interface SlashMenuItemProps {
  label: string
  kbd?: string
  onSelect: VoidFunction
}

function SlashMenuItem({ label, kbd, onSelect }: SlashMenuItemProps) {
  return (
    <AutocompleteItem className="meowdown-autocomplete-menu-item" onSelect={onSelect}>
      <span>{label}</span>
      {kbd && <kbd>{kbd}</kbd>}
    </AutocompleteItem>
  )
}

export function SlashMenu() {
  const editor = useEditor<EditorExtension>()

  return (
    <AutocompleteRoot regex={regex}>
      <AutocompletePositioner className="meowdown-autocomplete-menu-positioner">
        <AutocompletePopup className="meowdown-autocomplete-menu" data-testid="slash-menu">
          <SlashMenuItem
            label="Heading 1"
            kbd="#"
            onSelect={() => editor.commands.setHeading({ level: 1 })}
          />
          <SlashMenuItem
            label="Heading 2"
            kbd="##"
            onSelect={() => editor.commands.setHeading({ level: 2 })}
          />
          <SlashMenuItem
            label="Heading 3"
            kbd="###"
            onSelect={() => editor.commands.setHeading({ level: 3 })}
          />
          <SlashMenuItem
            label="Heading 4"
            kbd="####"
            onSelect={() => editor.commands.setHeading({ level: 4 })}
          />
          <SlashMenuItem
            label="Blockquote"
            kbd=">"
            onSelect={() => editor.commands.setBlockquote()}
          />
          <SlashMenuItem
            label="Bullet list"
            kbd="-"
            onSelect={() => editor.commands.wrapInList({ kind: 'bullet' })}
          />
          <SlashMenuItem
            label="Ordered list"
            kbd="1."
            onSelect={() => editor.commands.wrapInList({ kind: 'ordered' })}
          />
          <SlashMenuItem
            label="Task list"
            kbd="[]"
            onSelect={() => editor.commands.wrapInList({ kind: 'task' })}
          />
          <SlashMenuItem
            label="Code block"
            kbd="```"
            onSelect={() => editor.commands.setCodeBlock()}
          />
          <SlashMenuItem
            label="Table"
            onSelect={() => editor.commands.insertTable({ row: 3, col: 3 })}
          />
          <AutocompleteEmpty className="meowdown-autocomplete-menu-item">
            No results
          </AutocompleteEmpty>
        </AutocompletePopup>
      </AutocompletePositioner>
    </AutocompleteRoot>
  )
}
