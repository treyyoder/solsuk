import { useEffect, useState } from 'react'
import { breadcrumb, useFocusStore } from '../store/focusStore'
import type { FocusTarget } from '../simulation/types'
import { simClock, useSimStore, yearFromT } from '../store/simStore'
import { usePerfStore } from '../store/perfStore'
import { useSettingsStore, type Quality } from '../store/settingsStore'
import { fmtSimRate } from '../utils/time'
import { MAX_SPEED_LEVEL, MIN_SPEED_LEVEL } from '../simulation/constants'
import { SolsukLogo } from './SolsukLogo'

const ordinal = (d: number) =>
  d % 10 === 1 && d % 100 !== 11 ? 'st' : d % 10 === 2 && d % 100 !== 12 ? 'nd' : d % 10 === 3 && d % 100 !== 13 ? 'rd' : 'th'

function SimClockReadout() {
  const [, force] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 500)
    return () => window.clearInterval(id)
  }, [])
  const year = yearFromT(simClock.t)
  const yearInt = Math.floor(year)
  const dayIndex = Math.floor((year - yearInt) * 365.25)
  // calendar arithmetic handles month lengths — Jan 1 + N days
  const date = new Date(yearInt, 0, 1 + dayIndex)
  const month = date.toLocaleString('en-US', { month: 'long' })
  const day = date.getDate()
  const hh = Math.floor((simClock.t % 86400) / 3600)
  const mm = Math.floor((simClock.t % 3600) / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <span className="mono text-[11px] text-fg-dim">
      <span className="text-orbit">
        {month} {day}
        {ordinal(day)} {yearInt}
      </span>
      <span className="hidden md:inline">
        {' '}
        · {pad(hh)}:{pad(mm)}
      </span>
    </span>
  )
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
    <div className="glass pointer-events-auto flex h-12 items-center gap-3 rounded-xl px-4 max-md:h-auto max-md:min-h-12 max-md:flex-wrap max-md:gap-y-2 max-md:py-2">
      <button onClick={showLanding} aria-label="SOLSUK — home" className="font-display text-sm font-bold tracking-[0.28em]">
        <SolsukLogo />
      </button>
      <div className="mx-1 hidden h-5 w-px bg-edge md:block" />
      <nav className="hidden items-center gap-1.5 text-[11px] md:flex">
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

      <div className="mx-1 h-5 w-px bg-edge" />
      {/* quick-nav: fly straight to the three bodies */}
      <nav className="flex items-center gap-1 text-[11px]">
        {(
          [
            { label: 'SOL', target: { kind: 'sun' }, active: focus.kind === 'sun' },
            { label: 'TERRA', target: { kind: 'earth' }, active: focus.kind === 'earth' },
            { label: 'LUNA', target: { kind: 'moon' }, active: focus.kind === 'moon' },
          ] as { label: string; target: FocusTarget; active: boolean }[]
        ).map((n) => (
          <button
            key={n.label}
            onClick={() => setFocus(n.target)}
            className={`btn-ghost rounded px-1.5 py-0.5 tracking-wider ${n.active ? 'active text-orbit' : 'text-fg-dim'}`}
            title={`Fly to ${n.label}`}
          >
            {n.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 max-md:hidden" />

      <SimClockReadout />
      <button
        onClick={togglePause}
        className={`btn-ghost h-7 w-7 rounded-md text-xs max-md:hidden ${paused ? '' : 'active'}`}
        title={paused ? 'Resume' : 'Pause'}
      >
        {paused ? '▶' : '❚❚'}
      </button>
      {/* on phones the speed control gets its OWN full-width row — sharing the
          top row left it a ~50px track, which was unusable */}
      <div
        className="flex items-center gap-2 max-md:min-w-0 max-md:basis-full"
        title="Time warp: each level doubles simulated seconds per real second — negative levels run time BACKWARD, 0 holds it"
      >
        <input
          type="range"
          min={MIN_SPEED_LEVEL}
          max={MAX_SPEED_LEVEL}
          step={1}
          value={speedLevel}
          onChange={(e) => setSpeedLevel(parseInt(e.target.value))}
          className="w-24 max-md:min-w-0 max-md:flex-1"
        />
        <span className="mono w-9 shrink-0 text-right text-[10px] text-orbit">{speedLevel}×</span>
        <span className="mono hidden w-16 shrink-0 text-[9px] text-fg-dim md:inline">{fmtSimRate(speedLevel)}</span>
      </div>

      <div className="mx-1 hidden h-5 w-px bg-edge md:block" />

      <select
        value={settings.quality}
        onChange={(e) => settings.set({ quality: e.target.value as Quality })}
        className="mono hidden rounded border border-edge bg-panel px-1.5 py-1 text-[10px] uppercase text-fg-dim md:block"
      >
        {(['low', 'medium', 'high', 'ultra'] as Quality[]).map((q) => (
          <option key={q} value={q}>
            {q}
          </option>
        ))}
      </select>

      <div className="mono hidden w-14 text-right text-[11px] md:block">
        <span className={fps >= 50 ? 'text-orbit' : fps >= 30 ? 'text-sol' : 'text-alert'}>{fps}</span>
        <span className="text-fg-dim"> FPS</span>
      </div>
    </div>
  )
}
