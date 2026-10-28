import { defineBrowserConfig } from '@meowdown/vitest/config'
import react from '@vitejs/plugin-react'
import { mergeConfig } from 'vitest/config'

export default mergeConfig(defineBrowserConfig({ name: 'react-browser', groupOrder: 2000 }), {
  plugins: [react({ compiler: true })],
})
