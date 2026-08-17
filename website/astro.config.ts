import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import astrobook from 'astrobook'

export default defineConfig({
  integrations: [
    react(),
    astrobook({
      directory: 'src/stories',
      subpath: '/stories',
      previewSubpath: '/preview',
      title: 'Meowdown',
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    // If the target is below Safari 17.5, Lightning CSS downlevels `light-dark()` to a broken polyfill.
    build: { cssTarget: 'safari17.5' },
    server: {
      forwardConsole: {
        unhandledErrors: true,
        logLevels: ['error', 'warn', 'info', 'log', 'debug'],
      },
    },
  },
})
