import { defineVisualConfig } from '@meowdown/vitest/config'
import react from '@vitejs/plugin-react'
import { mergeConfig } from 'vitest/config'

export default mergeConfig(defineVisualConfig({ name: 'react-visual', groupOrder: 3000 }), {
  plugins: [react({ compiler: true })],
})
