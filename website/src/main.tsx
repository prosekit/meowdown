import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { installAnchorDebug } from './anchor-debug.ts'
import { App } from './app.tsx'

installAnchorDebug()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
