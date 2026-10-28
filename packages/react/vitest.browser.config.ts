import { defineBrowserConfig } from '@meowdown/vitest/config'
import react from '@vitejs/plugin-react'

export default defineBrowserConfig({
  name: 'react-browser',
  groupOrder: 2000,
  plugins: [react({ compiler: true })],
})
