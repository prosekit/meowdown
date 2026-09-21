import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const revision = process.argv[2]
const base =
  process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library/Caches/ms-playwright')
    : path.join(os.homedir(), '.cache/ms-playwright')

function find(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = find(full)
      if (found) return found
    } else if (entry.name === 'Google Chrome for Testing' || entry.name === 'chrome') {
      return full
    }
  }
}

const executable = find(path.join(base, `chromium-${revision}`))
if (!executable) throw new Error(`Chromium revision ${revision} not found under ${base}`)
console.log(`PROBE_CHROMIUM_PATH=${executable}`)
