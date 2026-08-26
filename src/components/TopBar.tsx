import { useEffect, useState } from 'react'
import { breadcrumb, useFocusStore } from '../store/focusStore'
import { simClock, useSimStore } from '../store/simStore'
import { usePerfStore } from '../store/perfStore'
import { useSettingsStore, type Quality } from '../store/settingsStore'
import { fmtSimClock } from '../utils/format'
import { fmtSimRate } from '../utils/time'
import { MAX_SPEED_LEVEL } from '../simulation/constants'
import { SolsukLogo } from './SolsukLogo'

function SimClockReadout() {
  const [, force] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 500)
    return () => window.clearInterval(id)
  }, [])
  return <span className="mono text-[11px] text-fg-dim">{fmtSimClock(simClock.t)}</span>
}

export function TopBar() {
  const focus = useFocusStore((s) => s.focus)
  const setFocus = useFocusStore((s) => s.setFocus)
  const showLanding = useFocusStore((s) => s.showLanding)
  const speedLevel = useSimStore((s) => s.speedLevel)
  const setSpeedLevel = useSimStore((s) => s.setSpeedLevel)
  const paused = useSimStore((s) => s.paused)
  const togglePause = useSimStore((s) => s.togglePause)
  const fps = usePerfStore((s) => s.fps)
  const settings = useSettingsStore()

  const crumbs = breadcrumb(focus)

  return (
    <div className="glass pointer-events-auto flex h-12 items-center gap-3 rounded-xl px-4">
      <button onClick={showLanding} aria-label="SOLSUK — home" className="font-display text-sm font-bold tracking-[0.28em]">
        <SolsukLogo />
      </button>
      <div className="mx-1 h-5 w-px bg-edge" />
      <nav className="flex items-center gap-1.5 text-[11px]">
        {crumbs.map((c, i) => (
          <span key={c.label} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-fg-dim">›</span>}
            <button
              onClick={() => setFocus(c.target)}
              className={`tracking-wider transition-colors hover:text-orbit ${i === crumbs.length - 1 ? 'text-orbit' : 'text-fg-dim'}`}
            >
              {c.label}
            </button>
          </span>
        ))}
      </nav>

      <div className="flex-1" />

      <SimClockReadout />
      <button onClick={togglePause} className={`btn-ghost h-7 w-7 rounded-md text-xs ${paused ? '' : 'active'}`} title={paused ? 'Resume' : 'Pause'}>
        {paused ? '▶' : '❚❚'}
      </button>
      <div className="flex items-center gap-2" title="Time warp: each level doubles simulated hours per real second">
        <input
          type="range"
          min={1}
          max={MAX_SPEED_LEVEL}
          step={1}
          value={speedLevel}
          onChange={(e) => setSpeedLevel(parseInt(e.target.value))}
          className="w-24"
        />
        <span className="mono w-8 shrink-0 text-[10px] text-orbit">{speedLevel}×</span>
        <span className="mono w-16 shrink-0 text-[9px] text-fg-dim">{fmtSimRate(speedLevel)}</span>
      </div>

      <div className="mx-1 h-5 w-px bg-edge" />

      <select
        value={settings.quality}
        onChange={(e) => settings.set({ quality: e.target.value as Quality })}
        className="mono rounded border border-edge bg-panel px-1.5 py-1 text-[10px] uppercase text-fg-dim"
      >
        {(['low', 'medium', 'high', 'ultra'] as Quality[]).map((q) => (
          <option key={q} value={q}>
            {q}
          </option>
        ))}
      </select>

      <div className="mono w-14 text-right text-[11px]">
        <span className={fps >= 50 ? 'text-orbit' : fps >= 30 ? 'text-sol' : 'text-alert'}>{fps}</span>
        <span className="text-fg-dim"> FPS</span>
      </div>
    </div>
  )
}
