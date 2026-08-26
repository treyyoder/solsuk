import { DEFAULT_TIME_SCALE } from '../simulation/constants'

/**
 * Speed control mapping. Level 1..MAX_SPEED_LEVEL, each level doubling the
 * simulated hours advanced per real second: 1x=1h/s, 2x=2h/s, 3x=4h/s,
 * 4x=8h/s, 5x=16h/s, 6x=32h/s, ...
 */
export function hoursPerSecond(level: number): number {
  return Math.pow(2, level - 1)
}

/** Internal sim-clock seconds advanced per real second, derived from the speed level.
 * DEFAULT_TIME_SCALE is the "1 hour per second" baseline pacing the app was tuned around. */
export function timeScaleForLevel(level: number): number {
  return DEFAULT_TIME_SCALE * hoursPerSecond(level)
}

/** Human-readable simulated rate, e.g. "1 h/s", "16 h/s", "2.30 d/s", "1.04 yr/s". */
export function fmtSimRate(level: number): string {
  const h = hoursPerSecond(level)
  if (h < 24) return `${h.toFixed(0)} h/s`
  const d = h / 24
  if (d < 365) return `${d.toFixed(d < 10 ? 2 : 1)} d/s`
  const y = d / 365
  if (y < 1e6) return `${y.toFixed(y < 10 ? 2 : 1)} yr/s`
  return `${y.toExponential(2)} yr/s`
}
