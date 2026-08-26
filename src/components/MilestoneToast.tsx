import { useSimStore } from '../store/simStore'
import { useFocusStore } from '../store/focusStore'

/** Cinematic milestone banner — appears when playback crosses a threshold year. */
export function MilestoneToast() {
  const milestone = useSimStore((s) => s.activeMilestone)
  const dismiss = useSimStore((s) => s.dismissMilestone)
  const setFocus = useFocusStore((s) => s.setFocus)

  if (!milestone) return null

  return (
    <div className="pointer-events-auto absolute left-1/2 top-16 z-30 -translate-x-1/2">
      <div className="glass-bright fade-up flex items-center gap-4 rounded-xl px-5 py-3">
        <span className="sol-text mono text-2xl font-bold">{Math.floor(milestone.year)}</span>
        <div className="max-w-md">
          <div className="text-sm font-semibold text-fg">{milestone.title}</div>
          {milestone.sub && <div className="text-[10px] text-fg-dim">{milestone.sub}</div>}
        </div>
        {milestone.focusId && (
          <button
            onClick={() => {
              setFocus({ kind: 'satellite', id: milestone.focusId! })
              dismiss()
            }}
            className="btn-ghost btn-sol shrink-0 rounded-md px-3 py-1.5 text-[10px] tracking-wider text-sol"
          >
            VIEW ⤵
          </button>
        )}
        <button onClick={dismiss} className="shrink-0 text-fg-dim transition-colors hover:text-fg">
          ✕
        </button>
      </div>
    </div>
  )
}
