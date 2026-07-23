import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/internal.ts', 'src/style.css'],
  platform: 'neutral',
  sourcemap: 'hidden',
  minify: true,
  target: 'es2022',
})
