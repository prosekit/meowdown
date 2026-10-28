import { isNodeOfType } from '@meowdown/core'
import type { EditorNode } from '@prosekit/pm/model'
import type { ReactNode } from 'react'
import { expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

import type { EditorHandle } from '../components/types.ts'

import { unhover } from './mouse.ts'

const frame = page.getByTestId('visual-frame')
const pmRoot = page.locate('.ProseMirror')

// Each viewport and each color scheme appears once, so two screenshots cover
// both dimensions.
const VARIANTS = [
  { viewport: 'desktop', width: 900, height: 600, theme: 'light' },
  { viewport: 'mobile', width: 390, height: 844, theme: 'dark' },
] as const

/**
 * Renders `element` in a page-sized frame. The frame paints the page
 * background, so a screenshot of it also covers popovers portaled to `body`.
 */
export async function renderVisual(element: ReactNode) {
  document.body.style.margin = '0'
  return await render(
    <div
      data-testid="visual-frame"
      style={{
        boxSizing: 'border-box',
        minHeight: '100vh',
        paddingBlock: 24,
        background: 'Canvas',
        color: 'CanvasText',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {element}
    </div>,
  )
}

/**
 * Matches the frame against one reference screenshot per variant. The color
 * scheme is set on the root element so portaled popovers follow it.
 */
export async function expectScreenshots(name: string): Promise<void> {
  const root = document.documentElement
  await unhover()
  try {
    for (const variant of VARIANTS) {
      await page.viewport(variant.width, variant.height)
      // A screenshot cannot reach below the viewport, so grow it to the content.
      const contentHeight = frame.element().scrollHeight
      if (contentHeight > variant.height) {
        await page.viewport(variant.width, contentHeight)
      }
      root.style.colorScheme = variant.theme
      await expect.element(frame).toMatchScreenshot(`${name}_${variant.viewport}_${variant.theme}`)
    }
  } finally {
    root.style.colorScheme = ''
    await page.viewport(900, 600)
  }
}

/**
 * An SVG image as a data URL, so rendering it never requests the network.
 */
export function createImageUrl(width: number, height: number, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/><circle cx="50%" cy="50%" r="${Math.min(width, height) / 4}" fill="white" fill-opacity="0.6"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function getDoc(handle: EditorHandle): EditorNode {
  const editor = handle.getEditor()
  if (!editor) throw new Error('editor not mounted')
  return editor.state.doc
}

/**
 * The position before each cell, by row and column.
 */
function getCellPositions(doc: EditorNode): number[][] {
  const rows: number[][] = []
  doc.descendants((node, pos) => {
    if (isNodeOfType(node, 'tableRow')) {
      rows.push([])
    } else if (isNodeOfType(node, 'tableCell') || isNodeOfType(node, 'tableHeaderCell')) {
      rows.at(-1)?.push(pos)
      return false
    }
    return true
  })
  return rows
}

function getTextPosition(doc: EditorNode, query: string): number {
  let found = -1
  doc.descendants((node, pos) => {
    if (found >= 0) return false
    const index = node.isText ? (node.text ?? '').indexOf(query) : -1
    if (index >= 0) found = pos + index
    return true
  })
  if (found < 0) throw new Error(`text not found: ${query}`)
  return found
}

/**
 * Focuses the editor and selects the cell rectangle between two
 * `[row, column]` corners.
 */
export async function selectCells(
  handle: EditorHandle,
  [anchorRow, anchorColumn]: [number, number],
  [headRow, headColumn]: [number, number],
): Promise<void> {
  const cells = getCellPositions(getDoc(handle))
  handle.focus()
  handle.setSelection({
    type: 'cell',
    anchor: cells[anchorRow][anchorColumn],
    head: cells[headRow][headColumn],
  })
  await expect.element(pmRoot.locate('.selectedCell').first()).toBeInTheDocument()
}

/**
 * Focuses the editor and selects from the start of the first text match of
 * `from` to the start of the first text match of `to`.
 */
export function selectText(handle: EditorHandle, from: string, to: string): void {
  const doc = getDoc(handle)
  handle.focus()
  handle.setSelection({
    type: 'text',
    anchor: getTextPosition(doc, from),
    head: getTextPosition(doc, to),
  })
}
