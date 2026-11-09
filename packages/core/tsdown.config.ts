import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/class-names.ts', 'src/style.css'],
  platform: 'neutral',
  sourcemap: 'hidden',
  minify: false,
  target: 'es2022',
})
