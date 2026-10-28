import { defineBrowserConfig } from '@meowdown/vitest/config'
import react from '@vitejs/plugin-react'

export default defineBrowserConfig({
  name: 'react-visual',
  visual: true,
  groupOrder: 3000,
  plugins: [react({ compiler: true })],
})
