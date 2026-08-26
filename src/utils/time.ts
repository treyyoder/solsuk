/**
 * Speed control mapping. Level 1..MAX_SPEED_LEVEL, each level doubling the
 * simulated seconds advanced per real second: 1x=1s/s (true real-time),
 * 2x=2s/s, 3x=4s/s, 4x=8s/s, ...
 */
export function secondsPerSecond(level: number): number {
  return Math.pow(2, level - 1)
}

/** Internal sim-clock seconds advanced per real second — the simClock unit
 * IS seconds, so at level 1 this is exactly 1 (real-time, no scaling). */
export function timeScaleForLevel(level: number): number {
  return secondsPerSecond(level)
}

/** Human-readable simulated rate, e.g. "1 s/s", "16 s/s", "2.30 min/s", "1.04 h/s", "3.10 d/s". */
export function fmtSimRate(level: number): string {
  const s = secondsPerSecond(level)
  if (s < 60) return `${s.toFixed(0)} s/s`
  const m = s / 60
  if (m < 60) return `${m.toFixed(m < 10 ? 2 : 1)} min/s`
  const h = m / 60
  if (h < 24) return `${h.toFixed(h < 10 ? 2 : 1)} h/s`
  const d = h / 24
  if (d < 365) return `${d.toFixed(d < 10 ? 2 : 1)} d/s`
  const y = d / 365
  if (y < 1e6) return `${y.toFixed(y < 10 ? 2 : 1)} yr/s`
  return `${y.toExponential(2)} yr/s`
}
