import { create } from 'zustand'
import { DEFAULT_SAT_COUNT, DEFAULT_TIME_SCALE, MAX_SAT_COUNT } from '../simulation/constants'
import { generateFleet, satConfigFor } from '../simulation/fleet'
import { illumination } from '../simulation/eclipse'
import { satPosition, sunDirection } from '../simulation/orbits'
import { initialStats, tickMoonBase, tickSatellite } from '../simulation/stats'
import { INITIAL_BASE_STATS, MOON_BASES } from '../simulation/moonBases'
import type { Crosslink, FleetAggregates, MoonStats, SatelliteConfig, SatelliteStats, Vec3 } from '../simulation/types'
import { mulberry32 } from '../utils/random'

/**
 * Perf split (the linchpin): positions are computed per-frame OUTSIDE React —
 * the render loop advances `simClock` and writes `satData.positions`; zustand
 * holds only the 10 Hz stats snapshot that DOM panels subscribe to.
 */
export const simClock = { t: 0 }
export const satData = {
  positions: new Float32Array(DEFAULT_SAT_COUNT * 3),
  /** bumped whenever the fleet is regenerated so render loops resize */
  version: 0,
}
export const sunDirCurrent: Vec3 = [1, 0, 0]

let fleet: SatelliteConfig[] = generateFleet(DEFAULT_SAT_COUNT)
let satIndex = new Map(fleet.map((s, i) => [s.id, i]))

export const getFleet = (): SatelliteConfig[] => fleet
export const satIndexOf = (id: string): number => satIndex.get(id) ?? 0
export const satConfigOf = (id: string): SatelliteConfig => fleet[satIndexOf(id)]

interface SimState {
  timeScale: number
  paused: boolean
  satCount: number
  /** bumped on fleet regeneration — components depending on fleet shape subscribe to this */
  fleetVersion: number
  stats: Record<string, SatelliteStats>
  moon: MoonStats
  aggregates: FleetAggregates
  setTimeScale: (s: number) => void
  togglePause: () => void
  setSatCount: (n: number) => void
  addSatellites: (n: number) => string
}

const rng = mulberry32(0xa11ce)

function buildInitialStats(list: SatelliteConfig[], prev?: Record<string, SatelliteStats>): Record<string, SatelliteStats> {
  const out: Record<string, SatelliteStats> = {}
  for (const cfg of list) out[cfg.id] = prev?.[cfg.id] ?? initialStats(cfg, rng)
  return out
}

const initialMoon: MoonStats = {
  bases: structuredClone(INITIAL_BASE_STATS),
  totalInhabitants: Object.values(INITIAL_BASE_STATS).reduce((n, b) => n + b.inhabitants, 0),
}

export const useSimStore = create<SimState>((set, get) => ({
  timeScale: DEFAULT_TIME_SCALE,
  paused: false,
  satCount: DEFAULT_SAT_COUNT,
  fleetVersion: 0,
  stats: buildInitialStats(fleet),
  moon: initialMoon,
  aggregates: { totalEffectiveEF: 0, totalSolarGW: 0, inEclipse: 0, meanUtilization: 0.7 },
  setTimeScale: (timeScale) => set({ timeScale }),
  togglePause: () => set((s) => ({ paused: !s.paused })),

  setSatCount: (n) => {
    const count = Math.max(1, Math.min(MAX_SAT_COUNT, Math.round(n)))
    const prev = get().stats
    fleet = generateFleet(count)
    satIndex = new Map(fleet.map((s, i) => [s.id, i]))
    satData.positions = new Float32Array(count * 3)
    satData.version++
    set({ satCount: count, fleetVersion: satData.version, stats: buildInitialStats(fleet, prev) })
  },

  addSatellites: (n) => {
    const start = fleet.length
    const count = Math.min(MAX_SAT_COUNT, start + n)
    for (let i = start; i < count; i++) fleet.push(satConfigFor(i))
    satIndex = new Map(fleet.map((s, i) => [s.id, i]))
    const positions = new Float32Array(count * 3)
    positions.set(satData.positions.subarray(0, Math.min(satData.positions.length, count * 3)))
    satData.positions = positions
    satData.version++
    set({ satCount: count, fleetVersion: satData.version, stats: buildInitialStats(fleet, get().stats) })
    return fleet[count - 1].id
  },
}))

let loopStarted = false
const posScratch: Vec3 = [0, 0, 0]

/** Crosslinks are only derived for one satellite (the focused one) — O(n), not O(n²). */
export function crosslinksFor(id: string): Crosslink[] {
  const i = satIndexOf(id) * 3
  const p = satData.positions
  let best1 = -1
  let best2 = -1
  let d1 = Infinity
  let d2 = Infinity
  for (let j = 0; j < fleet.length; j++) {
    if (j * 3 === i) continue
    const d = Math.hypot(p[i] - p[j * 3], p[i + 1] - p[j * 3 + 1], p[i + 2] - p[j * 3 + 2])
    if (d < d1) {
      d2 = d1
      best2 = best1
      d1 = d
      best1 = j
    } else if (d < d2) {
      d2 = d
      best2 = j
    }
  }
  const out: Crosslink[] = []
  if (best1 >= 0) out.push({ to: fleet[best1].id, gbps: +(160 / (0.5 + d1) + Math.random() * 6).toFixed(1) })
  if (best2 >= 0) out.push({ to: fleet[best2].id, gbps: +(160 / (0.5 + d2) + Math.random() * 6).toFixed(1) })
  return out
}

let focusedSatId: string | null = null
export function setStatsFocus(id: string | null) {
  focusedSatId = id
}

/** 10 Hz stats loop — call once from main.tsx. Positions in satData are kept fresh by the render loop. */
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
    const dt = Math.min(wallDt * state.timeScale, 30)

    sunDirection(t, sunDirCurrent)

    const stats: Record<string, SatelliteStats> = {}
    let totalEF = 0
    let totalMW = 0
    let inEclipse = 0
    let utilSum = 0
    const pos = satData.positions
    for (let idx = 0; idx < fleet.length; idx++) {
      const cfg = fleet[idx]
      const i = idx * 3
      if (pos[i] === 0 && pos[i + 1] === 0 && pos[i + 2] === 0) {
        satPosition(cfg, t, sunDirCurrent, posScratch)
        pos[i] = posScratch[0]
        pos[i + 1] = posScratch[1]
        pos[i + 2] = posScratch[2]
      }
      posScratch[0] = pos[i]
      posScratch[1] = pos[i + 1]
      posScratch[2] = pos[i + 2]
      const illum = illumination(posScratch, sunDirCurrent)
      const links = cfg.id === focusedSatId ? crosslinksFor(cfg.id) : (state.stats[cfg.id]?.crosslinks ?? [])
      const next = tickSatellite(cfg, state.stats[cfg.id] ?? initialStats(cfg, rng), posScratch, illum, links, t, dt, rng)
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
        meanUtilization: utilSum / Math.max(fleet.length, 1),
      },
    })
  }, 100)
}
