import { createRoot } from 'react-dom/client'

import { App } from './app.tsx'

// No StrictMode: its double-invoked effects attach the probe twice, and a probe
// that doubles its own entries is worse than no probe.
createRoot(document.getElementById('root')!).render(<App />)
