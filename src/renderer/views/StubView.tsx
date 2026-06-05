import type { ViewName } from '../../shared/views'

/**
 * Skeleton placeholder for every hotkey view. Real views (Done overlay, morning
 * intake chat, CRM popover, etc.) replace these per-view in Phase 2a.
 */
export function StubView({
  view,
  onClose,
}: {
  view: ViewName
  onClose: () => void
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-neutral-900 text-neutral-100">
      <h1 className="text-2xl font-semibold tracking-tight">{view}</h1>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md border border-neutral-600 px-4 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800"
      >
        Close
      </button>
    </div>
  )
}
