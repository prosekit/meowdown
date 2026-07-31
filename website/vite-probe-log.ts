import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Connect, Plugin } from 'vite'

const ENDPOINT = '/__probe/log'
const LOG_DIR = join(import.meta.dirname, 'probe-logs')
const MAX_BODY_BYTES = 64 * 1024 * 1024

function sanitize(value: string): string {
  return value.replaceAll(/[^\w.-]+/g, '-').replaceAll(/^-+|-+$/g, '') || 'unknown'
}

function readBody(request: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error(`probe log body exceeds ${MAX_BODY_BYTES} bytes`))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

const middleware: Connect.NextHandleFunction = (request, response, next) => {
  if (!request.url?.startsWith(ENDPOINT)) {
    next()
    return
  }
  if (request.method !== 'POST') {
    response.statusCode = 405
    response.end('POST only')
    return
  }
  void readBody(request)
    .then((body) => {
      const log: unknown = JSON.parse(body)
      const { session, page, entries } =
        typeof log === 'object' && log != null
          ? (log as { session?: string; page?: string; entries?: unknown[] })
          : {}
      if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })
      const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-')
      const name = `${sanitize(session ?? 'no-session')}__${sanitize(page ?? 'no-page')}__${stamp}.json`
      writeFileSync(join(LOG_DIR, name), body, 'utf8')
      console.info(`[probe] saved ${entries?.length ?? 0} entries to probe-logs/${name}`)
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ ok: true, file: name, entries: entries?.length ?? 0 }))
    })
    .catch((error: unknown) => {
      console.error('[probe] failed to save log:', error)
      response.statusCode = 500
      response.end(JSON.stringify({ ok: false, error: String(error) }))
    })
}

/**
 * Dev-server sink for the iPhone probe pages: `POST /__probe/log` lands as one
 * JSON file per run under `website/probe-logs/`. Registered for both `vite` and
 * `vite preview`, because a real device run may use either.
 */
export function probeLog(): Plugin {
  return {
    name: 'probe-log',
    configureServer: (server) => {
      server.middlewares.use(middleware)
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(middleware)
    },
  }
}
