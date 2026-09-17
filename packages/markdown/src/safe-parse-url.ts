export function safeParseURL(src: string): URL | undefined {
  try {
    return new URL(src)
  } catch {
    return undefined
  }
}
