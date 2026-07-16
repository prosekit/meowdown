import { CHAR_BACKTICK } from '@meowdown/markdown'

/** Length of the longest run of `charCode` in `text`, at least `min`. */
export function longestCharRun(text: string, charCode: number, min = 0): number {
  let longest = min
  let run = 0
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === charCode) {
      run++
      if (run > longest) longest = run
    } else {
      run = 0
    }
  }
  return longest
}

/** Length of the longest run of backticks in `text`, at least `min`. */
export function longestBacktickRun(text: string, min = 0): number {
  return longestCharRun(text, CHAR_BACKTICK, min)
}
