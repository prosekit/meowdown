import { useEffect, useState, type ReactElement } from 'react'

import { snapshotEnv, watchEnv } from './probe/env.ts'
import { PROBE_PAGES } from './probe/pages.tsx'
import { LogPanel } from './probe/panel.tsx'
import { beaconSave, flushMirroredRun, sessionId, setPage } from './probe/recorder.ts'

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash || '#/')
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  return hash
}

function EnvTable(): ReactElement {
  const env = snapshotEnv()
  const media = env.media as Record<string, boolean>
  const viewport = env.viewport as Record<string, unknown>
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-stone-300 p-3 text-xs dark:border-stone-700">
      <h2 className="text-xs font-semibold tracking-wide uppercase opacity-60">环境</h2>
      <p className="font-mono break-all opacity-70">{String(env.userAgent)}</p>
      <p className="font-mono opacity-70">
        maxTouchPoints={String(env.maxTouchPoints)} dpr={String(viewport.devicePixelRatio)} inner=
        {String(viewport.innerWidth)}×{String(viewport.innerHeight)} visual=
        {String(viewport.visualWidth)}×{String(viewport.visualHeight)}
      </p>
      <ul className="grid grid-cols-2 gap-x-3 font-mono opacity-70">
        {Object.entries(media).map(([query, matches]) => (
          <li key={query}>
            {matches ? '✅' : '⬜️'} {query}
          </li>
        ))}
      </ul>
    </section>
  )
}

function HomePage(): ReactElement {
  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Meowdown iPhone caret 探针</h1>
        <p className="text-sm opacity-70">
          按顺序做完 P1 到 P8，每页做完都点一次「保存日志」。session {sessionId}
        </p>
      </header>

      <EnvTable />

      <nav className="flex flex-col gap-2">
        {PROBE_PAGES.map((page) => (
          <a
            key={page.path}
            href={page.path}
            className="rounded-xl border border-stone-300 p-3 dark:border-stone-700"
          >
            <div className="font-semibold">{page.title}</div>
            <div className="text-sm opacity-70">{page.blurb}</div>
          </a>
        ))}
      </nav>

      <LogPanel />
    </div>
  )
}

export function App(): ReactElement {
  const hash = useHash()
  const page = PROBE_PAGES.find((candidate) => candidate.path === hash)

  useEffect(() => {
    setPage(hash)
  }, [hash])

  useEffect(() => {
    flushMirroredRun()
    const stopWatching = watchEnv()
    const onPageHide = () => beaconSave()
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      stopWatching()
    }
  }, [])

  if (page == null) return <HomePage />
  // Keying on the path tears down the previous page's probe before the next one
  // attaches, so no run ever records another page's events.
  return <div key={page.path}>{page.render()}</div>
}
