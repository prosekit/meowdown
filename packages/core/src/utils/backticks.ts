import { CHAR_BACKTICK } from '../unicode.ts'

/** Length of the longest run of backticks in `text`, at least `min`. */
export function longestBacktickRun(text: string, min = 0): number {
  let longest = min
  let run = 0
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === CHAR_BACKTICK) {
      run++
      if (run > longest) longest = run
    } else {
      run = 0
    }
  }
  return longest
}
