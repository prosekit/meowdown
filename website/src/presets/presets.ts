export interface Preset {
  id: string
  content: string
}

// Adding a preset = dropping a new .md file into this directory. The id is the
// file name, rendered directly in the UI; its numeric prefix orders the list,
// and the first preset seeds the editor.
const presetModules = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export const PRESETS: Preset[] = Object.entries(presetModules).map(([path, content]) => ({
  id: path.slice('./'.length, -'.md'.length),
  content,
}))

export function getPresetContent(id: string): string {
  const preset = PRESETS.find((candidate) => candidate.id === id)
  return preset ? preset.content : ''
}
