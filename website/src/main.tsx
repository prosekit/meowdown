import './index.css'

import { MyReactComponent } from '@meowdown/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div>
      <MyReactComponent />
    </div>
  </StrictMode>,
)
