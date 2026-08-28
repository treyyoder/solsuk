/**
 * Speed control mapping. SIGNED level −MAX..+MAX: the magnitude doubles the
 * simulated seconds advanced per real second (|1| = 1 s/s true real-time,
 * |2| = 2 s/s, |3| = 4 s/s, ...), and the SIGN is time's direction —
 * negative levels run the simulation backward. Level 0 holds time still.
 */
export function secondsPerSecond(level: number): number {
  if (level === 0) return 0
  return Math.sign(level) * Math.pow(2, Math.abs(level) - 1)
}

/** Internal sim-clock seconds advanced per real second — the simClock unit
 * IS seconds, so at level 1 this is exactly 1 (real-time, no scaling). */
export function timeScaleForLevel(level: number): number {
  return secondsPerSecond(level)
}

/** Human-readable simulated rate, e.g. "1 s/s", "−16 s/s", "2.30 min/s", "1.04 h/s", "3.10 d/s". */
export function fmtSimRate(level: number): string {
  if (level === 0) return 'held'
  const sign = level < 0 ? '−' : ''
  const s = Math.abs(secondsPerSecond(level))
  if (s < 60) return `${sign}${s.toFixed(0)} s/s`
  const m = s / 60
  if (m < 60) return `${sign}${m.toFixed(m < 10 ? 2 : 1)} min/s`
  const h = m / 60
  if (h < 24) return `${sign}${h.toFixed(h < 10 ? 2 : 1)} h/s`
  const d = h / 24
  if (d < 365) return `${sign}${d.toFixed(d < 10 ? 2 : 1)} d/s`
  const y = d / 365
  if (y < 1e6) return `${sign}${y.toFixed(y < 10 ? 2 : 1)} yr/s`
  return `${sign}${y.toExponential(2)} yr/s`
}
