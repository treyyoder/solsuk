import { create } from 'zustand'
import { DEFAULT_SPEED_LEVEL, MAX_SPEED_LEVEL } from '../simulation/constants'
import { timeScaleForLevel } from '../utils/time'
import { facilityConfigFor } from '../simulation/fleet'
import { illumination } from '../simulation/eclipse'
import { satPosition, sunDirection } from '../simulation/orbits'
import { initialStats, tickMoonBase, tickSatellite } from '../simulation/stats'
import { INITIAL_BASE_STATS, MOON_BASES } from '../simulation/moonBases'
import {
  computeEpoch,
  DEFAULT_CONFIG,
  END_YEAR,
  FACILITY_CLASSES,
  MILESTONES,
  START_YEAR,
  YEAR_SECONDS,
  type EpochState,
  type FacilityClass,
  type Milestone,
  type SimConfig,
} from '../simulation/epochModel'
import type { Crosslink, MoonStats, SatelliteConfig, SatelliteStats, Vec3 } from '../simulation/types'
import { mulberry32 } from '../utils/random'

/**
 * Perf split: positions are computed per-frame OUTSIDE React — the render
 * loop advances `simClock` and writes `satData.positions`; zustand holds the
 * 10 Hz snapshot (epoch aggregates + the focused facility's live stats).
 * With fleets up to ~30k facilities, per-facility stat ticking is reserved
 * for the ONE focused facility; everything fleet-wide comes from the epoch
 * model, which is what makes timeline scrubbing instant.
 */
export const simClock = { t: 0 }
export const satData = {
  positions: new Float32Array(1024 * 3),
  /** bumped whenever the fleet ARRAY IDENTITY/ordering changes */
  version: 0,
}
export const sunDirCurrent: Vec3 = [1, 0, 0]

export const yearFromT = (t: number): number => START_YEAR + t / YEAR_SECONDS
export const tFromYear = (y: number): number => (y - START_YEAR) * YEAR_SECONDS

// ---------------------------------------------------------------- fleet (module-level, non-reactive)

let fleet: SatelliteConfig[] = []
let fleetByClass: Record<FacilityClass, SatelliteConfig[]> = {
  pioneer: [], cluster: [], edge: [], standard: [], hyper: [], giga: [],
}
let satIndex = new Map<string, number>()
let largestFacility: SatelliteConfig | null = null

export const getFleet = (): SatelliteConfig[] => fleet
export const getFleetByClass = (): Record<FacilityClass, SatelliteConfig[]> => fleetByClass
export const satIndexOf = (id: string): number => satIndex.get(id) ?? 0
export const satConfigOf = (id: string): SatelliteConfig | undefined => fleet[satIndex.get(id) ?? -1]
export const getLargestFacility = (): SatelliteConfig | null => largestFacility

/** Grow/shrink per-class fleets to match the epoch counts. Facilities keep
 * identity (cls, k) so scrubbing back and forth is stable. Returns true if
 * anything changed. */
function syncFleet(epoch: EpochState, config: SimConfig): boolean {
  let changed = false
  for (const cls of FACILITY_CLASSES) {
    const want = epoch.counts[cls]
    const arr = fleetByClass[cls]
    if (arr.length === want) continue
    changed = true
    if (arr.length > want) arr.length = want
    else for (let k = arr.length; k < want; k++) arr.push(facilityConfigFor(cls, k, config))
  }
  if (!changed) return false

  fleet = FACILITY_CLASSES.flatMap((cls) => fleetByClass[cls])
  satIndex = new Map(fleet.map((s, i) => [s.id, i]))
  largestFacility = fleet.reduce<SatelliteConfig | null>((best, f) => (!best || f.powerMW > best.powerMW ? f : best), null)
  if (satData.positions.length < fleet.length * 3) {
    const next = new Float32Array(Math.ceil(fleet.length * 1.3) * 3)
    next.set(satData.positions)
    satData.positions = next
  }
  satData.version++
  return true
}

/** wipe and rebuild everything (config changed → powers/commission years shift) */
function rebuildFleet(epoch: EpochState, config: SimConfig) {
  fleetByClass = { pioneer: [], cluster: [], edge: [], standard: [], hyper: [], giga: [] }
  syncFleet(epoch, config)
  satData.version++
}

// ---------------------------------------------------------------- store

export interface ActiveMilestone extends Milestone {
  shownAt: number
  focusId?: string
}

interface SimState {
  /** 1..MAX_SPEED_LEVEL; each level doubles simulated seconds/sec (see utils/time.ts) */
  speedLevel: number
  timeScale: number
  paused: boolean
  year: number
  epoch: EpochState
  config: SimConfig
  fleetVersion: number
  focusedStats: SatelliteStats | null
  moon: MoonStats
  activeMilestone: ActiveMilestone | null
  setSpeedLevel: (level: number) => void
  togglePause: () => void
  setYear: (y: number) => void
  setConfig: (patch: Partial<SimConfig>) => void
  launchFacility: () => string | null
  dismissMilestone: () => void
}

const rng = mulberry32(0xa11ce)

const initialMoon: MoonStats = {
  bases: structuredClone(INITIAL_BASE_STATS),
  totalInhabitants: Object.values(INITIAL_BASE_STATS).reduce((n, b) => n + b.inhabitants, 0),
}

const initialEpoch = computeEpoch(START_YEAR, DEFAULT_CONFIG)
syncFleet(initialEpoch, DEFAULT_CONFIG)

export const useSimStore = create<SimState>((set, get) => ({
  speedLevel: DEFAULT_SPEED_LEVEL,
  timeScale: timeScaleForLevel(DEFAULT_SPEED_LEVEL),
  paused: false,
  year: START_YEAR,
  epoch: initialEpoch,
  config: structuredClone(DEFAULT_CONFIG),
  fleetVersion: satData.version,
  focusedStats: null,
  moon: initialMoon,
  activeMilestone: null,

  setSpeedLevel: (level) => {
    const speedLevel = Math.max(1, Math.min(MAX_SPEED_LEVEL, Math.round(level)))
    set({ speedLevel, timeScale: timeScaleForLevel(speedLevel) })
  },
  togglePause: () => set((s) => ({ paused: !s.paused })),

  setYear: (y) => {
    const year = Math.max(START_YEAR, Math.min(END_YEAR, y))
    simClock.t = tFromYear(year)
    const { config } = get()
    const epoch = computeEpoch(year, config)
    syncFleet(epoch, config)
    // scrubbing never fires milestone events — they only trigger during playback
    set({ year, epoch, fleetVersion: satData.version, activeMilestone: null })
  },

  setConfig: (patch) => {
    const config = { ...get().config, ...patch, extraFacilities: { ...get().config.extraFacilities, ...(patch.extraFacilities ?? {}) } }
    const epoch = computeEpoch(get().year, config)
    rebuildFleet(epoch, config)
    set({ config, epoch, fleetVersion: satData.version })
  },

  /** +LAUNCH: adds one facility of the era's flagship class, on top of the model */
  launchFacility: () => {
    const { year, config, epoch } = get()
    const flagship: FacilityClass =
      epoch.counts.giga > 0 ? 'giga'
      : epoch.counts.hyper > 0 ? 'hyper'
      : epoch.counts.standard > 0 ? 'standard'
      : epoch.counts.edge > 0 ? 'edge'
      : epoch.counts.cluster > 0 ? 'cluster'
      : 'pioneer'
    const extraFacilities = { ...config.extraFacilities, [flagship]: (config.extraFacilities[flagship] ?? 0) + 1 }
    const nextConfig = { ...config, extraFacilities }
    const nextEpoch = computeEpoch(year, nextConfig)
    syncFleet(nextEpoch, nextConfig)
    set({ config: nextConfig, epoch: nextEpoch, fleetVersion: satData.version })
    const arr = fleetByClass[flagship]
    return arr.length ? arr[arr.length - 1].id : null
  },

  dismissMilestone: () => set({ activeMilestone: null }),
}))

// ---------------------------------------------------------------- crosslinks (focused facility only)

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
  const gbps = (dst: number) => +(160 / (0.5 + dst) + Math.random() * 6).toFixed(1)
  const out: Crosslink[] = []
  if (best1 >= 0) out.push({ to: fleet[best1].id, gbps: gbps(d1) })
  if (best2 >= 0) out.push({ to: fleet[best2].id, gbps: gbps(d2) })
  return out
}

let focusedSatId: string | null = null
export function setStatsFocus(id: string | null) {
  focusedSatId = id
}

// ---------------------------------------------------------------- 10 Hz loop

let loopStarted = false
const posScratch: Vec3 = [0, 0, 0]

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
    const prevYear = state.year
    const year = Math.min(END_YEAR, yearFromT(simClock.t))
    // clamp the REAL elapsed time (tab-sleep catch-up guard), then scale
    const dt = Math.min(wallDt, 1) * state.timeScale

    sunDirection(simClock.t, sunDirCurrent)

    const epoch = computeEpoch(year, state.config)
    syncFleet(epoch, state.config)

    // milestone crossings — playback only (setYear clears instead)
    let activeMilestone = state.activeMilestone
    const crossed = MILESTONES.find((m) => m.year > prevYear && m.year <= year)
    if (crossed) {
      let focusId: string | undefined
      if (crossed.focusClass) {
        const arr = fleetByClass[crossed.focusClass]
        if (arr.length) focusId = arr[arr.length - 1].id
      }
      activeMilestone = { ...crossed, shownAt: now, focusId }
    } else if (activeMilestone && now - activeMilestone.shownAt > 9000) {
      activeMilestone = null
    }

    // focused facility live stats
    let focusedStats: SatelliteStats | null = null
    if (focusedSatId) {
      const cfg = satConfigOf(focusedSatId)
      if (cfg) {
        const i = satIndexOf(focusedSatId) * 3
        posScratch[0] = satData.positions[i]
        posScratch[1] = satData.positions[i + 1]
        posScratch[2] = satData.positions[i + 2]
        if (Math.hypot(...posScratch) < 0.5) satPosition(cfg, simClock.t, sunDirCurrent, posScratch)
        const illum = illumination(posScratch, sunDirCurrent)
        focusedStats = tickSatellite(
          cfg,
          state.focusedStats ?? initialStats(cfg, rng),
          posScratch,
          illum,
          crosslinksFor(cfg.id),
          simClock.t,
          Math.min(dt, 60),
          rng,
          epoch.computeEffTFperKW,
        )
      }
    }

    const bases: MoonStats['bases'] = {}
    for (const base of MOON_BASES) bases[base.id] = tickMoonBase(state.moon.bases[base.id], Math.min(dt, 60), rng)
    const moon: MoonStats = {
      bases,
      totalInhabitants: Object.values(bases).reduce((n, b) => n + b.inhabitants, 0),
    }

    useSimStore.setState({ year, epoch, moon, focusedStats, activeMilestone, fleetVersion: satData.version })
  }, 100)
}
