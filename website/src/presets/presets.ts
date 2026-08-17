export interface Preset {
  id: string
  label: string
  content: string
}

// Adding a preset = dropping a new .md file into this directory. The id is the
// file name and the label derives from it (`nested-lists.md` -> "Nested lists").
const presetModules = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export const PRESETS: Preset[] = Object.entries(presetModules)
  .map(([path, content]) => {
    const id = path.slice('./'.length, -'.md'.length)
    const label = id.charAt(0).toUpperCase() + id.slice(1).replaceAll('-', ' ')
    return { id, label, content }
  })
  .sort((first, second) =>
    first.id === 'default' ? -1 : second.id === 'default' ? 1 : first.id.localeCompare(second.id),
  )

export const DEFAULT_PRESET_ID = 'default'

export function getPresetContent(id: string): string {
  const preset = PRESETS.find((candidate) => candidate.id === id)
  return preset ? preset.content : ''
}
