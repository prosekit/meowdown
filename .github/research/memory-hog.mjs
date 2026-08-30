// Hold incompressible memory to push the runner toward memory exhaustion,
// simulating the pressure under which the WebKit job fails.
import { randomFillSync } from 'node:crypto'

const targetGB = Number(process.argv[2] || 3.5)
const CHUNK = 64 * 1024 * 1024
const chunks = []

while ((chunks.length * CHUNK) / 1024 ** 3 < targetGB) {
  const buffer = Buffer.allocUnsafe(CHUNK)
  randomFillSync(buffer)
  chunks.push(buffer)
  console.log(`hog holds ${((chunks.length * CHUNK) / 1024 ** 3).toFixed(2)} GB`)
}

setInterval(() => {
  for (const buffer of chunks) {
    buffer[0] ^= 1
  }
  console.log(`hog alive with ${chunks.length} chunks`)
}, 30_000)
