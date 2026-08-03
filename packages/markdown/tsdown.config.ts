import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  platform: 'neutral',
  sourcemap: 'hidden',
  minify: false,
  target: 'es2022',
})
