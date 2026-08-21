import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import astrobook from 'astrobook'

import { version } from '../packages/react/package.json' with { type: 'json' }

export default defineConfig({
  integrations: [
    react(),
    astrobook({
      directory: 'src/stories',
      subpath: '/playground',
      previewSubpath: '/preview',
      title: 'Meowdown',
      homeContent: {
        title: 'Meowdown',
        version: {
          label: `v${version}`,
          href: 'https://github.com/prosekit/meowdown/blob/master/CHANGELOG.md',
        },
        repo: {
          href: 'https://github.com/prosekit/meowdown',
          label: 'View on GitHub',
        },
      },
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
