// Hold incompressible memory and keep touching every page so macOS cannot
// page it out, shrinking the runner's free-memory headroom.
import { randomFillSync } from 'node:crypto'

const targetGB = Number(process.argv[2] || 1.5)
const touchMs = Number(process.argv[3] || 500)
const CHUNK = 64 * 1024 * 1024
const PAGE = 16384
const chunks = []

while ((chunks.length * CHUNK) / 1024 ** 3 < targetGB) {
  const buffer = Buffer.allocUnsafe(CHUNK)
  randomFillSync(buffer)
  chunks.push(buffer)
  console.log(`hog holds ${((chunks.length * CHUNK) / 1024 ** 3).toFixed(2)} GB`)
}

setInterval(() => {
  for (const buffer of chunks) {
    for (let offset = 0; offset < buffer.length; offset += PAGE) {
      buffer[offset] ^= 1
    }
  }
}, touchMs)
