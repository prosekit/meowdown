/**
 * The value rounded to an integer, or nothing unless it is a finite number
 * above zero.
 */
export function toPositiveNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }
}
