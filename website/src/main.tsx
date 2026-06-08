import './index.css'

import { Editor } from '@meowdown/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div>
      <Editor />
    </div>
  </StrictMode>,
)
