import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'src/index.ts',
  platform: 'neutral',
  sourcemap: 'hidden',
  minify: true,
  target: 'es2022',
})
