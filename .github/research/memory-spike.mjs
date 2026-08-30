// Repeatedly spawn a child that allocates incompressible memory as fast as
// possible, holds briefly, and exits, so a spike can land inside the fuzz
// phase before the memory-pressure response adapts. A killed child is logged
// and the cycle continues.
import { spawn } from 'node:child_process'
import { randomFillSync } from 'node:crypto'

const gb = Number(process.argv[3] || process.argv[2] || 2.5)

if (process.argv[2] === 'child') {
  const CHUNK = 64 * 1024 * 1024
  const chunks = []
  while ((chunks.length * CHUNK) / 1024 ** 3 < gb) {
    const buffer = Buffer.allocUnsafe(CHUNK)
    randomFillSync(buffer)
    chunks.push(buffer)
  }
  console.log(`spike holding ${gb} GB at ${new Date().toISOString()}`)
  setTimeout(() => process.exit(0), 8000)
} else {
  const loop = () => {
    const child = spawn(process.execPath, [process.argv[1], 'child', String(gb)], { stdio: 'inherit' })
    child.on('exit', (code, signal) => {
      console.log(`spike child exited code=${code} signal=${signal} at ${new Date().toISOString()}`)
      setTimeout(loop, 25_000)
    })
  }
  loop()
}
