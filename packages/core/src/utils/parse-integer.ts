export function parseInteger(raw: string | null | undefined): number | undefined {
  if (raw == null) return undefined
  const value = Number.parseInt(raw, 10)
  return Number.isSafeInteger(value) ? value : undefined
}

export function parsePositiveInteger(raw: string | null | undefined): number | undefined {
  const value = parseInteger(raw)
  return value != null && value > 0 ? value : undefined
}
