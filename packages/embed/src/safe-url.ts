export function getSafeUrl(
  value: string,
  protocols?: readonly string[] | null,
): string | undefined {
  if (
    Array.from(value).some((character) => {
      return character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127
    })
  )
    return
  try {
    const url = new URL(value)
    if (url.username || url.password) return
    if (url.protocol === 'https:' || url.protocol === 'http:' || protocols?.includes(url.protocol))
      return url.href
  } catch {
    return
  }
}
