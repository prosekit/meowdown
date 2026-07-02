const UNITS = ['KB', 'MB', 'GB', 'TB'] as const

/**
 * Format a byte count for display on a file pill: decimal units (1 KB =
 * 1000 B, matching macOS Finder), one decimal below 10, integers otherwise.
 */
export function formatFileSize(bytes: number): string {
  let value = bytes
  let unit: 'B' | (typeof UNITS)[number] = 'B'
  for (const next of UNITS) {
    // 999.5 rounds up to 1000, so it moves to the next unit instead.
    if (value < 999.5) break
    value /= 1000
    unit = next
  }
  if (unit === 'B') return `${Math.round(value)} B`
  const rounded = value < 9.95 ? Math.round(value * 10) / 10 : Math.round(value)
  return `${rounded} ${unit}`
}
