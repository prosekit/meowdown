import type { ReactNode } from 'react'
import { expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

import { unhover } from './mouse.ts'

const frame = page.getByTestId('visual-frame')

const VIEWPORTS = [
  { name: 'desktop', width: 900, height: 600 },
  { name: 'mobile', width: 390, height: 844 },
] as const

const THEMES = ['light', 'dark'] as const

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
 * Matches the frame against one reference screenshot per viewport and color
 * scheme. The color scheme is set on the root element so portaled popovers
 * follow it.
 */
export async function expectScreenshots(name: string): Promise<void> {
  const root = document.documentElement
  await unhover()
  try {
    for (const viewport of VIEWPORTS) {
      await page.viewport(viewport.width, viewport.height)
      // A screenshot cannot reach below the viewport, so grow it to the content.
      const contentHeight = frame.element().scrollHeight
      if (contentHeight > viewport.height) {
        await page.viewport(viewport.width, contentHeight)
      }
      for (const theme of THEMES) {
        root.style.colorScheme = theme
        await expect.element(frame).toMatchScreenshot(`${name}-${viewport.name}-${theme}`)
      }
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
