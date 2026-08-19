import { DailyNotes as DailyNotesComponent } from './daily-notes.tsx'
import { MainEditor as MainEditorComponent } from './main-editor.tsx'
import { TaskList as TaskListComponent } from './task-list.tsx'

const STORY_COMPONENTS = {
  'main-editor': MainEditorComponent,
  'daily-notes': DailyNotesComponent,
  'task-list': TaskListComponent,
}

interface StoryProps {
  story: keyof typeof STORY_COMPONENTS
}

// astrobook renders every named export with the single default component, so
// one file with all three stories needs this dispatcher.
function Story({ story }: StoryProps) {
  const StoryComponent = STORY_COMPONENTS[story]
  return <StoryComponent />
}

export default {
  component: Story,
}

export const MainEditor = { args: { story: 'main-editor' } satisfies StoryProps }

export const DailyNotes = { args: { story: 'daily-notes' } satisfies StoryProps }

export const TaskList = { args: { story: 'task-list' } satisfies StoryProps }
