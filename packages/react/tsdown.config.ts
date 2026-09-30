import react from '@vitejs/plugin-react'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/style.css'],
  platform: 'neutral',
  sourcemap: 'hidden',
  minify: false,
  target: 'es2022',
  css: {
    modules: {
      generateScopedName: 'meow_[local]_[hash]',
    },
  },
  plugins: [
    react({
      compiler: true,
      // The default filter also matches the generated `.d.ts` files, which
      // turns `dist/index.d.ts` into an empty `export {}` without any error.
      exclude: [/node_modules/, /\.d\.ts$/],
    }),
  ],
})
