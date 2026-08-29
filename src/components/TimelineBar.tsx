import { useEffect, useRef, useState } from 'react'
import { simClock, useSimStore, yearFromT } from '../store/simStore'
import { END_YEAR, MILESTONES, START_YEAR, TIMELINE_JUMPS } from '../simulation/epochModel'

const SPAN = END_YEAR - START_YEAR
/** speed level that traverses roughly one simulated year every ~7 real seconds */
const ERA_PLAY_LEVEL = 23

/**
 * The future-history timeline: 2026 → 2084 scrubber with milestone markers,
 * era jump chips, and an "era play" fast-forward that tours the whole arc.
 */
export function TimelineBar() {
  const setYear = useSimStore((s) => s.setYear)
  const paused = useSimStore((s) => s.paused)
  const togglePause = useSimStore((s) => s.togglePause)
  const speedLevel = useSimStore((s) => s.speedLevel)
  const setSpeedLevel = useSimStore((s) => s.setSpeedLevel)

  // the year ticks continuously — render from simClock at 4 Hz without
  // waiting for the 10 Hz store snapshot
  const [, force] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 250)
    return () => window.clearInterval(id)
  }, [])
  const year = Math.min(END_YEAR, yearFromT(simClock.t))

  const eraPlaying = speedLevel === ERA_PLAY_LEVEL && !paused
  const prevLevel = useRef(1)
  const [hover, setHover] = useState<{ frac: number; year: number } | null>(null)

  const toggleEraPlay = () => {
    if (eraPlaying) {
      setSpeedLevel(prevLevel.current)
    } else {
      prevLevel.current = speedLevel
      setSpeedLevel(ERA_PLAY_LEVEL)
      if (paused) togglePause()
    }
  }

  return (
    <div className="glass pointer-events-auto flex h-14 items-center gap-4 rounded-xl px-4">
      <div className="flex shrink-0 items-baseline gap-2">
        <span className="mono text-xl font-semibold text-orbit">{Math.floor(year)}</span>
        <span className="mono text-[10px] text-fg-dim">.{String(Math.floor((year % 1) * 10))}</span>
      </div>

      <button
        onClick={toggleEraPlay}
        className={`btn-ghost btn-sol shrink-0 rounded-md px-2.5 py-1.5 text-[10px] tracking-wider ${eraPlaying ? 'active' : ''}`}
        title="Fast-forward through the whole 2026–2084 arc (~1 simulated year every few seconds)"
      >
        {eraPlaying ? '■ ERA' : '▶ ERA'}
      </button>

      {/* scrubber with milestone markers + hover-year readout */}
      <div
        className="relative min-w-0 flex-1 self-stretch"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
          setHover({ frac, year: Math.floor(START_YEAR + frac * SPAN) })
        }}
        onMouseLeave={() => setHover(null)}
      >
        {hover && (
          <div
            className="pointer-events-none absolute bottom-[calc(50%+10px)] z-10 -translate-x-1/2 rounded border border-edge bg-panel/95 px-1.5 py-0.5 mono text-[10px] text-orbit"
            style={{ left: `${hover.frac * 100}%` }}
          >
            {hover.year}
          </div>
        )}
        <input
          type="range"
          min={START_YEAR}
          max={END_YEAR}
          step={0.05}
          value={year}
          onChange={(e) => setYear(parseFloat(e.target.value))}
          className="absolute inset-x-0 top-1/2 w-full -translate-y-1/2"
        />
        {MILESTONES.map((m) => (
          <div
            key={m.year}
            title={`${Math.floor(m.year)} — ${m.title}`}
            className="pointer-events-none absolute top-[calc(50%+8px)] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-sol/70"
            style={{ left: `${((m.year - START_YEAR) / SPAN) * 100}%` }}
          />
        ))}
      </div>

      {/* era jump chips — desktop only; on a phone the scrubber gets the width */}
      <div className="hidden shrink-0 items-center gap-1 md:flex">
        {TIMELINE_JUMPS.map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={`btn-ghost rounded px-1.5 py-1 text-[9px] ${Math.abs(year - y) < 0.5 ? 'active' : ''}`}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  )
}
