import { create } from 'zustand'
import { DEFAULT_TIME_SCALE, NUM_SATS } from '../simulation/constants'
import { generateFleet } from '../simulation/fleet'
import { illumination } from '../simulation/eclipse'
import { satPosition, sunDirection } from '../simulation/orbits'
import { initialStats, tickMoonBase, tickSatellite } from '../simulation/stats'
import { INITIAL_BASE_STATS, MOON_BASES } from '../simulation/moonBases'
import type { Crosslink, FleetAggregates, MoonStats, SatelliteConfig, SatelliteStats, Vec3 } from '../simulation/types'
import { mulberry32 } from '../utils/random'

/**
 * Perf split (the linchpin): positions are computed per-frame OUTSIDE React —
 * the render loop advances `simClock` and writes `satPositions`; zustand holds
 * only the 10 Hz stats snapshot that DOM panels subscribe to.
 */
export const simClock = { t: 0 }
export const satPositions = new Float32Array(NUM_SATS * 3)
export const sunDirCurrent: Vec3 = [1, 0, 0]

export const FLEET: SatelliteConfig[] = generateFleet()
const satIndex = new Map(FLEET.map((s, i) => [s.id, i]))

interface SimState {
  timeScale: number
  paused: boolean
  stats: Record<string, SatelliteStats>
  moon: MoonStats
  aggregates: FleetAggregates
  setTimeScale: (s: number) => void
  togglePause: () => void
}

const rng = mulberry32(0xa11ce)

const initialSatStats: Record<string, SatelliteStats> = {}
for (const cfg of FLEET) initialSatStats[cfg.id] = initialStats(cfg, rng)

const initialMoon: MoonStats = {
  bases: structuredClone(INITIAL_BASE_STATS),
  totalInhabitants: Object.values(INITIAL_BASE_STATS).reduce((n, b) => n + b.inhabitants, 0),
}

export const useSimStore = create<SimState>((set) => ({
  timeScale: DEFAULT_TIME_SCALE,
  paused: false,
  stats: initialSatStats,
  moon: initialMoon,
  aggregates: { totalEffectiveEF: 0, totalSolarGW: 0, inEclipse: 0, meanUtilization: 0.7 },
  setTimeScale: (timeScale) => set({ timeScale }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
}))

/** Two nearest same-shell neighbors — the optical crosslink partners. */
function neighborsOf(cfg: SatelliteConfig, rand: () => number): Crosslink[] {
  const shellSats = FLEET.filter((s) => s.shell === cfg.shell && s.id !== cfg.id)
  const i = satIndex.get(cfg.id)! * 3
  const withDist = shellSats.map((s) => {
    const j = satIndex.get(s.id)! * 3
    const d = Math.hypot(
      satPositions[i] - satPositions[j],
      satPositions[i + 1] - satPositions[j + 1],
      satPositions[i + 2] - satPositions[j + 2],
    )
    return { s, d }
  })
  withDist.sort((a, b) => a.d - b.d)
  return withDist.slice(0, 2).map(({ s, d }) => ({ to: s.id, gbps: +(160 / (0.5 + d) + rand() * 6).toFixed(1) }))
}

let loopStarted = false
const posScratch: Vec3 = [0, 0, 0]

/** 10 Hz stats loop — call once from main.tsx. Positions in satPositions are kept fresh by the render loop. */
export function startSimLoop() {
  if (loopStarted) return
  loopStarted = true
  let last = performance.now()
  window.setInterval(() => {
    const now = performance.now()
    const wallDt = (now - last) / 1000
    last = now
    const state = useSimStore.getState()
    if (state.paused) return
    const t = simClock.t
    const dt = Math.min(wallDt * state.timeScale, 30) // sim-seconds elapsed, clamped for tab-sleep

    sunDirection(t, sunDirCurrent)

    const stats: Record<string, SatelliteStats> = {}
    let totalEF = 0
    let totalMW = 0
    let inEclipse = 0
    let utilSum = 0
    for (const cfg of FLEET) {
      const i = satIndex.get(cfg.id)! * 3
      // fall back to computing the position if the render loop hasn't written yet
      if (satPositions[i] === 0 && satPositions[i + 1] === 0 && satPositions[i + 2] === 0) {
        satPosition(cfg, t, posScratch)
        satPositions[i] = posScratch[0]
        satPositions[i + 1] = posScratch[1]
        satPositions[i + 2] = posScratch[2]
      }
      posScratch[0] = satPositions[i]
      posScratch[1] = satPositions[i + 1]
      posScratch[2] = satPositions[i + 2]
      const illum = illumination(posScratch, sunDirCurrent)
      const next = tickSatellite(cfg, state.stats[cfg.id], posScratch, illum, neighborsOf(cfg, rng), t, dt, rng)
      stats[cfg.id] = next
      totalEF += next.effectiveExaflops
      totalMW += next.solarMW
      if (next.eclipsed) inEclipse++
      utilSum += next.utilization
    }

    const bases: MoonStats['bases'] = {}
    for (const base of MOON_BASES) bases[base.id] = tickMoonBase(state.moon.bases[base.id], dt, rng)
    const moon: MoonStats = {
      bases,
      totalInhabitants: Object.values(bases).reduce((n, b) => n + b.inhabitants, 0),
    }

    useSimStore.setState({
      stats,
      moon,
      aggregates: {
        totalEffectiveEF: totalEF,
        totalSolarGW: totalMW / 1000,
        inEclipse,
        meanUtilization: utilSum / FLEET.length,
      },
    })
  }, 100)
}

export const satIndexOf = (id: string): number => satIndex.get(id) ?? 0
