import {
  getTableColumnAlign,
  type EditorExtension,
  type TableColumnAlign,
  type TypedEditor,
} from '@meowdown/core'
import { useEditor, useEditorDerivedValue } from '@prosekit/react'
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
import type { ReactElement, ReactNode } from 'react'
import { useCallback } from 'react'

import styles from './table-handle.module.css'

function TableHandleItem({
  children,
  onSelect,
  testId,
  active = false,
  danger = false,
}: {
  children: ReactNode
  onSelect: VoidFunction
  testId: string
  active?: boolean
  danger?: boolean
}): ReactNode {
  return (
    <MenuItem
      className={styles.MenuItem}
      onSelect={onSelect}
      data-testid={testId}
      data-active={active ? '' : undefined}
      data-danger={danger ? '' : undefined}
    >
      {children}
    </MenuItem>
  )
}

// Insert Left
function canInsertLeft(editor: TypedEditor): boolean {
  return editor.commands.addTableColumnBefore.canExec()
}
function runInsertLeft(editor: TypedEditor): void {
  editor.commands.addTableColumnBefore()
}
function TableMenuInsertLeft({ editor }: { editor: TypedEditor }): ReactNode {
  const canExec = useEditorDerivedValue(canInsertLeft)
  const handler = useCallback(() => runInsertLeft(editor), [editor])

  return canExec ? (
    <TableHandleItem testId="table-insert-left" onSelect={handler}>
      <span>Insert Left</span>
    </TableHandleItem>
  ) : null
}

// Insert Right
function canInsertRight(editor: TypedEditor): boolean {
  return editor.commands.addTableColumnAfter.canExec()
}
function runInsertRight(editor: TypedEditor): void {
  editor.commands.addTableColumnAfter()
}
function TableMenuInsertRight({ editor }: { editor: TypedEditor }): ReactNode {
  const canExec = useEditorDerivedValue(canInsertRight)
  const handler = useCallback(() => runInsertRight(editor), [editor])

  return canExec ? (
    <TableHandleItem testId="table-insert-right" onSelect={handler}>
      <span>Insert Right</span>
    </TableHandleItem>
  ) : null
}

// Align
function canAlign(editor: TypedEditor): boolean {
  return editor.commands.setTableColumnAlign.canExec('left')
}
function getActiveAlign(editor: TypedEditor): TableColumnAlign | undefined {
  return getTableColumnAlign(editor.state)
}
function runAlign(editor: TypedEditor, align: TableColumnAlign, active: boolean): void {
  // Selecting the current alignment again clears it back to `---`.
  editor.commands.setTableColumnAlign(active ? null : align)
}
function TableMenuAlignItem({
  label,
  editor,
  align,
  activeAlign,
}: {
  label: string
  editor: TypedEditor
  align: TableColumnAlign
  activeAlign?: TableColumnAlign
}): ReactNode {
  const active = activeAlign === align
  const handler = useCallback(() => runAlign(editor, align, active), [editor, align, active])
  return (
    <TableHandleItem testId={`table-align-${align}`} active={active} onSelect={handler}>
      <span>{label}</span>
      {active && <CheckIcon />}
    </TableHandleItem>
  )
}
function TableMenuAlignItems({ editor }: { editor: TypedEditor }): ReactNode {
  const activeAlign = useEditorDerivedValue(getActiveAlign)
  return (
    <>
      <TableMenuAlignItem
        align="left"
        label="Align Left"
        editor={editor}
        activeAlign={activeAlign}
      />
      <TableMenuAlignItem
        align="center"
        label="Align Center"
        editor={editor}
        activeAlign={activeAlign}
      />
      <TableMenuAlignItem
        align="right"
        label="Align Right"
        editor={editor}
        activeAlign={activeAlign}
      />
    </>
  )
}
function TableMenuAlign({ editor }: { editor: TypedEditor }): ReactNode {
  const canExec = useEditorDerivedValue(canAlign)
  return canExec ? <TableMenuAlignItems editor={editor} /> : null
}

// Clear Contents
function canClearContents(editor: TypedEditor): boolean {
  return editor.commands.deleteCellSelection.canExec()
}
function runClearContents(editor: TypedEditor): void {
  editor.commands.deleteCellSelection()
}
function TableMenuClearContents({
  editor,
  testId,
}: {
  editor: TypedEditor
  testId: string
}): ReactNode {
  const canExec = useEditorDerivedValue(canClearContents)
  const handler = useCallback(() => runClearContents(editor), [editor])

  return canExec ? (
    <TableHandleItem testId={testId} onSelect={handler}>
      <span>Clear Contents</span>
      <kbd>Del</kbd>
    </TableHandleItem>
  ) : null
}

// Delete Column
function canDeleteColumn(editor: TypedEditor): boolean {
  return editor.commands.deleteTableColumn.canExec()
}
function runDeleteColumn(editor: TypedEditor): void {
  editor.commands.deleteTableColumn()
}
function TableMenuDeleteColumn({ editor }: { editor: TypedEditor }): ReactNode {
  const canExec = useEditorDerivedValue(canDeleteColumn)
  const handler = useCallback(() => runDeleteColumn(editor), [editor])

  return canExec ? (
    <TableHandleItem testId="table-delete-column" onSelect={handler}>
      <span>Delete Column</span>
    </TableHandleItem>
  ) : null
}

// Insert Above
function canInsertAbove(editor: TypedEditor): boolean {
  return editor.commands.addTableRowAbove.canExec()
}
function runInsertAbove(editor: TypedEditor): void {
  editor.commands.addTableRowAbove()
}
function TableMenuInsertAbove({ editor }: { editor: TypedEditor }): ReactNode {
  const canExec = useEditorDerivedValue(canInsertAbove)
  const handler = useCallback(() => runInsertAbove(editor), [editor])

  return canExec ? (
    <TableHandleItem testId="table-insert-above" onSelect={handler}>
      <span>Insert Above</span>
    </TableHandleItem>
  ) : null
}

// Insert Below
function canInsertBelow(editor: TypedEditor): boolean {
  return editor.commands.addTableRowBelow.canExec()
}
function runInsertBelow(editor: TypedEditor): void {
  editor.commands.addTableRowBelow()
}
function TableMenuInsertBelow({ editor }: { editor: TypedEditor }): ReactNode {
  const canExec = useEditorDerivedValue(canInsertBelow)
  const handler = useCallback(() => runInsertBelow(editor), [editor])

  return canExec ? (
    <TableHandleItem testId="table-insert-below" onSelect={handler}>
      <span>Insert Below</span>
    </TableHandleItem>
  ) : null
}

// Delete Row
function canDeleteRow(editor: TypedEditor): boolean {
  return editor.commands.deleteTableRow.canExec()
}
function runDeleteRow(editor: TypedEditor): void {
  editor.commands.deleteTableRow()
}
function TableMenuDeleteRow({ editor }: { editor: TypedEditor }): ReactNode {
  const canExec = useEditorDerivedValue(canDeleteRow)
  const handler = useCallback(() => runDeleteRow(editor), [editor])

  return canExec ? (
    <TableHandleItem testId="table-delete-row" onSelect={handler}>
      <span>Delete Row</span>
    </TableHandleItem>
  ) : null
}

// Delete Table
function canDeleteTable(editor: TypedEditor): boolean {
  return editor.commands.deleteTable.canExec()
}
function runDeleteTable(editor: TypedEditor): void {
  editor.commands.deleteTable()
}
function TableMenuDeleteTable({
  editor,
  testId,
}: {
  editor: TypedEditor
  testId: string
}): ReactNode {
  const canExec = useEditorDerivedValue(canDeleteTable)
  const handler = useCallback(() => runDeleteTable(editor), [editor])

  return canExec ? (
    <TableHandleItem testId={testId} danger onSelect={handler}>
      <span>Delete Table</span>
    </TableHandleItem>
  ) : null
}

export function TableHandle(): ReactElement {
  const editor = useEditor<EditorExtension>()

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
                <TableMenuInsertLeft editor={editor} />
                <TableMenuInsertRight editor={editor} />
                <TableMenuAlign editor={editor} />
                <TableMenuClearContents editor={editor} testId="table-clear-column" />
                <TableMenuDeleteColumn editor={editor} />
                <TableMenuDeleteTable editor={editor} testId="table-delete-table-column" />
              </MenuPopup>
            </MenuPositioner>
          </TableHandleColumnMenuRoot>
        </TableHandleColumnPopup>
      </TableHandleColumnPositioner>

      <TableHandleRowPositioner className={styles.Positioner}>
        <TableHandleRowPopup className={styles.RowPopup}>
          <TableHandleRowMenuRoot>
            <TableHandleRowMenuTrigger className={styles.Trigger} data-testid="table-handle-row">
              <GripVerticalIcon />
            </TableHandleRowMenuTrigger>
            <MenuPositioner className={styles.MenuPositioner}>
              <MenuPopup className={styles.MenuPopup} data-testid="table-handle-row-menu">
                <TableMenuInsertAbove editor={editor} />
                <TableMenuInsertBelow editor={editor} />
                <TableMenuClearContents editor={editor} testId="table-clear-row" />
                <TableMenuDeleteRow editor={editor} />
                <TableMenuDeleteTable editor={editor} testId="table-delete-table-row" />
              </MenuPopup>
            </MenuPositioner>
          </TableHandleRowMenuRoot>
        </TableHandleRowPopup>
      </TableHandleRowPositioner>
    </TableHandleRoot>
  )
}
