import pluginBabel from '@rolldown/plugin-babel'
import { reactCompilerPreset } from '@vitejs/plugin-react'
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
  plugins: [pluginBabel({ presets: [reactCompilerPreset()] })],
})
