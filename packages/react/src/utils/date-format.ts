export type TimeFormat = '12' | '24'

/** Formats the current wall-clock time for the `/now` slash command. */
export function formatNowTime(timeFormat: TimeFormat): string {
  return formatTime(new Date(), timeFormat)
}

/** Formats a given time as `3:45pm` ('12') or `15:45` ('24'). */
export function formatTime(date: Date, timeFormat: TimeFormat): string {
  return timeFormat === '12' ? formatTime12(date) : formatTime24(date)
}

// 12-hour clock drops the leading zero on the hour: "3:45pm", "12:08am".
function formatTime12(date: Date): string {
  const hours = date.getHours() % 12 || 12
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const meridiem = date.getHours() >= 12 ? 'pm' : 'am'
  return `${hours}:${minutes}${meridiem}`
}

// 24-hour clock keeps the leading zero on the hour: "15:45", "09:08".
function formatTime24(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}
