import { getTableColumnAlign, type EditorExtension, type TableColumnAlign } from '@meowdown/core'
import type { Editor } from '@prosekit/core'
import { useEditorDerivedValue } from '@prosekit/react'
import { MenuItem, MenuPopup, MenuPositioner } from '@prosekit/react/menu'
import {
  TableHandleColumnMenuRoot,
  TableHandleColumnMenuTrigger,
  TableHandleColumnPopup,
  TableHandleColumnPositioner,
  TableHandleDragPreview,
  TableHandleDropIndicator,
  TableHandleRoot,
  TableHandleRowMenuRoot,
  TableHandleRowMenuTrigger,
  TableHandleRowPopup,
  TableHandleRowPositioner,
} from '@prosekit/react/table-handle'
import { CheckIcon, GripHorizontalIcon, GripVerticalIcon } from 'lucide-react'

import styles from './table-handle.module.css'

function getTableHandleState(editor: Editor<EditorExtension>) {
  const commands = editor.commands
  const columnAlign = getTableColumnAlign(editor.state)
  return {
    columnAlign,
    setTableColumnAlign: {
      canExec: commands.setTableColumnAlign.canExec('left'),
      // Selecting the current alignment again clears it back to `---`.
      command: (align: TableColumnAlign) =>
        commands.setTableColumnAlign(columnAlign === align ? null : align),
    },
    addTableColumnBefore: {
      canExec: commands.addTableColumnBefore.canExec(),
      command: () => commands.addTableColumnBefore(),
    },
    addTableColumnAfter: {
      canExec: commands.addTableColumnAfter.canExec(),
      command: () => commands.addTableColumnAfter(),
    },
    addTableRowAbove: {
      canExec: commands.addTableRowAbove.canExec(),
      command: () => commands.addTableRowAbove(),
    },
    addTableRowBelow: {
      canExec: commands.addTableRowBelow.canExec(),
      command: () => commands.addTableRowBelow(),
    },
    deleteCellSelection: {
      canExec: commands.deleteCellSelection.canExec(),
      command: () => commands.deleteCellSelection(),
    },
    deleteTableColumn: {
      canExec: commands.deleteTableColumn.canExec(),
      command: () => commands.deleteTableColumn(),
    },
    deleteTableRow: {
      canExec: commands.deleteTableRow.canExec(),
      command: () => commands.deleteTableRow(),
    },
    deleteTable: {
      canExec: commands.deleteTable.canExec(),
      command: () => commands.deleteTable(),
    },
  }
}

const COLUMN_ALIGN_LABELS: Record<TableColumnAlign, string> = {
  left: 'Align Left',
  center: 'Align Center',
  right: 'Align Right',
}

function ColumnAlignMenuItem({
  align,
  columnAlign,
  onSelect,
}: {
  align: TableColumnAlign
  columnAlign: TableColumnAlign | undefined
  onSelect: () => void
}) {
  const active = columnAlign === align
  return (
    <MenuItem
      className={styles.MenuItem}
      data-testid={`table-align-${align}`}
      data-active={active ? '' : undefined}
      onSelect={onSelect}
    >
      <span>{COLUMN_ALIGN_LABELS[align]}</span>
      {active && <CheckIcon />}
    </MenuItem>
  )
}

export function TableHandle() {
  const state = useEditorDerivedValue(getTableHandleState)

  return (
    <TableHandleRoot>
      <TableHandleDragPreview />
      <TableHandleDropIndicator />

      <TableHandleColumnPositioner className={styles.Positioner}>
        <TableHandleColumnPopup className={styles.ColumnPopup}>
          <TableHandleColumnMenuRoot>
            <TableHandleColumnMenuTrigger
              className={styles.Trigger}
              data-testid="table-handle-column"
            >
              <GripHorizontalIcon />
            </TableHandleColumnMenuTrigger>
            <MenuPositioner className={styles.MenuPositioner}>
              <MenuPopup className={styles.MenuPopup} data-testid="table-handle-column-menu">
                {state.addTableColumnBefore.canExec && (
                  <MenuItem
                    className={styles.MenuItem}
                    data-testid="table-insert-left"
                    onSelect={state.addTableColumnBefore.command}
                  >
                    <span>Insert Left</span>
                  </MenuItem>
                )}
                {state.addTableColumnAfter.canExec && (
                  <MenuItem
                    className={styles.MenuItem}
                    data-testid="table-insert-right"
                    onSelect={state.addTableColumnAfter.command}
                  >
                    <span>Insert Right</span>
                  </MenuItem>
                )}
                {state.setTableColumnAlign.canExec && (
                  <>
                    <ColumnAlignMenuItem
                      align="left"
                      columnAlign={state.columnAlign}
                      onSelect={() => state.setTableColumnAlign.command('left')}
                    />
                    <ColumnAlignMenuItem
                      align="center"
                      columnAlign={state.columnAlign}
                      onSelect={() => state.setTableColumnAlign.command('center')}
                    />
                    <ColumnAlignMenuItem
                      align="right"
                      columnAlign={state.columnAlign}
                      onSelect={() => state.setTableColumnAlign.command('right')}
                    />
                  </>
                )}
                {state.deleteCellSelection.canExec && (
                  <MenuItem
                    className={styles.MenuItem}
                    data-testid="table-clear-column"
                    onSelect={state.deleteCellSelection.command}
                  >
                    <span>Clear Contents</span>
                    <kbd>Del</kbd>
                  </MenuItem>
                )}
                {state.deleteTableColumn.canExec && (
                  <MenuItem
                    className={styles.MenuItem}
                    data-testid="table-delete-column"
                    onSelect={state.deleteTableColumn.command}
                  >
                    <span>Delete Column</span>
                  </MenuItem>
                )}
                {state.deleteTable.canExec && (
                  <MenuItem
                    className={styles.MenuItem}
                    data-danger=""
                    data-testid="table-delete-table-column"
                    onSelect={state.deleteTable.command}
                  >
                    <span>Delete Table</span>
                  </MenuItem>
                )}
              </MenuPopup>
            </MenuPositioner>
          </TableHandleColumnMenuRoot>
        </TableHandleColumnPopup>
      </TableHandleColumnPositioner>

      <TableHandleRowPositioner placement="left" className={styles.Positioner}>
        <TableHandleRowPopup className={styles.RowPopup}>
          <TableHandleRowMenuRoot>
            <TableHandleRowMenuTrigger className={styles.Trigger} data-testid="table-handle-row">
              <GripVerticalIcon />
            </TableHandleRowMenuTrigger>
            <MenuPositioner className={styles.MenuPositioner}>
              <MenuPopup className={styles.MenuPopup} data-testid="table-handle-row-menu">
                {state.addTableRowAbove.canExec && (
                  <MenuItem
                    className={styles.MenuItem}
                    data-testid="table-insert-above"
                    onSelect={state.addTableRowAbove.command}
                  >
                    <span>Insert Above</span>
                  </MenuItem>
                )}
                {state.addTableRowBelow.canExec && (
                  <MenuItem
                    className={styles.MenuItem}
                    data-testid="table-insert-below"
                    onSelect={state.addTableRowBelow.command}
                  >
                    <span>Insert Below</span>
                  </MenuItem>
                )}
                {state.deleteCellSelection.canExec && (
                  <MenuItem
                    className={styles.MenuItem}
                    data-testid="table-clear-row"
                    onSelect={state.deleteCellSelection.command}
                  >
                    <span>Clear Contents</span>
                    <kbd>Del</kbd>
                  </MenuItem>
                )}
                {state.deleteTableRow.canExec && (
                  <MenuItem
                    className={styles.MenuItem}
                    data-testid="table-delete-row"
                    onSelect={state.deleteTableRow.command}
                  >
                    <span>Delete Row</span>
                  </MenuItem>
                )}
                {state.deleteTable.canExec && (
                  <MenuItem
                    className={styles.MenuItem}
                    data-danger=""
                    data-testid="table-delete-table-row"
                    onSelect={state.deleteTable.command}
                  >
                    <span>Delete Table</span>
                  </MenuItem>
                )}
              </MenuPopup>
            </MenuPositioner>
          </TableHandleRowMenuRoot>
        </TableHandleRowPopup>
      </TableHandleRowPositioner>
    </TableHandleRoot>
  )
}
