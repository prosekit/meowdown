import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { probeLog } from './vite-probe-log.ts'

export default defineConfig({
  plugins: [react(), tailwindcss(), probeLog()],
  // If the target is below Safari 17.5, Lightning CSS downlevels `light-dark()` to a broken polyfill.
  build: { cssTarget: 'safari17.5' },
  server: {
    // A real iPhone on the same Wi-Fi has to reach the dev server.
    host: true,
    forwardConsole: {
      unhandledErrors: true,
      logLevels: ['error', 'warn', 'info', 'log', 'debug'],
    },
  },
  preview: { host: true },
})
