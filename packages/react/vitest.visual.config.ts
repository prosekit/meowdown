import { defineBrowserConfig } from '@meowdown/vitest/config'
import react from '@vitejs/plugin-react'

export default defineBrowserConfig({
  name: 'react-visual',
  groupOrder: 3000,
  plugins: [react({ compiler: true })],
  visual: true,
})
