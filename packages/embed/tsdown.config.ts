import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/utils/index.ts', 'src/x/index.ts', 'src/youtube/index.ts'],
  platform: 'neutral',
  sourcemap: 'hidden',
  minify: false,
  target: 'es2022',
  copy: [
    { from: 'src/x/theme.css', to: 'dist/x/' },
    { from: 'src/youtube/theme.css', to: 'dist/youtube/' },
  ],
})
