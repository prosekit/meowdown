import { clsx } from 'clsx/lite'

export type SyncStatus = 'editing' | 'saved'

const STATUS_LABEL: Record<SyncStatus, string> = {
  editing: 'Editing…',
  saved: 'Saved',
}

export function SyncStatusPill({ status }: { status: SyncStatus }) {
  const editing = status === 'editing'
  return (
    <span
      role="status"
      aria-live="polite"
      className={clsx(
        'ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        editing
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300'
          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300',
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'size-1.5 rounded-full',
          editing ? 'animate-pulse bg-amber-500' : 'bg-emerald-500',
        )}
      />
      {STATUS_LABEL[status]}
    </span>
  )
}
