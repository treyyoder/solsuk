import type { Crosslink, MoonBaseStats, SatelliteConfig, SatelliteStats, Vec3 } from './types'
import { GROUND_STATIONS, slantRange, stationVisible } from './groundStations'

/**
 * Live per-facility flavor, ticked at ~10 Hz for the FOCUSED facility only
 * (fleet-wide aggregates come from the epoch model, not per-facility sums).
 * Pure: (prev, env, dt) → next. Numbers are fictional but sized from the
 * facility's actual modeled power draw.
 */

export function initialStats(_cfg: SatelliteConfig, rng: () => number): SatelliteStats {
  return {
    utilization: 0.55 + rng() * 0.3,
    activeJobs: Math.floor(80 + rng() * 400),
    effectiveExaflops: 0,
    tempC: 18 + rng() * 8,
    illumination: 1,
    eclipsed: false,
    solarMW: 0,
    batteryPct: 70 + rng() * 25,
    charging: true,
    crosslinks: [],
    groundVisible: false,
    downlinkGbps: 0,
    latencyMs: 0,
  }
}

export function tickSatellite(
  cfg: SatelliteConfig,
  prev: SatelliteStats,
  pos: Vec3,
  illum: number,
  neighbors: Crosslink[],
  t: number,
  dt: number,
  rng: () => number,
  /** current FP16 compute efficiency, TFLOPS per kW (from the epoch model) */
  effTFperKW: number,
): SatelliteStats {
  // --- compute: mean-reverting utilization random walk ---
  const lowBattery = prev.batteryPct < 20
  const target = lowBattery ? 0.25 : 0.72
  let utilization = prev.utilization + (target - prev.utilization) * 0.02 * dt + (rng() - 0.5) * 0.045 * Math.sqrt(dt)
  utilization = Math.max(0.05, Math.min(0.99, utilization))
  const effectiveExaflops = (cfg.powerMW * 1000 * effTFperKW * utilization) / 1e6
  const activeJobs = Math.max(4, Math.round(prev.activeJobs + (rng() - 0.5 + (utilization - 0.7) * 0.4) * 24 * dt))
  // clamped: at high time-warp levels dt can be huge, and this term is otherwise unbounded
  const tempC = Math.max(-40, Math.min(140, prev.tempC + ((14 + utilization * 42 - prev.tempC) * 0.05 + (rng() - 0.5) * 0.3) * dt))

  // --- solar / battery: array sized ~8% above the facility's electrical draw ---
  const solarMW = cfg.powerMW * 1.08 * illum
  const loadMW = cfg.powerMW * (0.25 + utilization * 0.75)
  const netMW = solarMW - loadMW
  const batteryMWh = cfg.powerMW * 2 // ~2 hours of storage
  const batteryPct = Math.max(0, Math.min(100, prev.batteryPct + ((netMW * dt) / 3600 / batteryMWh) * 100 * 60))

  // --- transmission ---
  const station = GROUND_STATIONS.find((g) => g.id === cfg.groundStationId)!
  const groundVisible = stationVisible(station, pos, t)
  const range = slantRange(station, pos, t)
  // downlink scales with the era's optics — approximated from facility size
  const eraGbps = 40 + cfg.powerMW * 25
  const downlinkGbps = groundVisible ? +((eraGbps / (1 + range * 0.4)) * (0.9 + rng() * 0.2)).toFixed(1) : 0
  const latencyMs = groundVisible ? +(range * 2.2 + 4 + rng() * 1.5).toFixed(1) : 0

  return {
    utilization,
    activeJobs,
    effectiveExaflops,
    tempC,
    illumination: illum,
    eclipsed: illum < 0.5,
    solarMW,
    batteryPct,
    charging: netMW > 0,
    crosslinks: neighbors,
    groundVisible,
    downlinkGbps,
    latencyMs,
  }
}

export function tickMoonBase(prev: MoonBaseStats, dt: number, rng: () => number): MoonBaseStats {
  const oxygenPct = Math.max(93, Math.min(100, prev.oxygenPct + (rng() - 0.495) * 0.05 * dt))
  const experiments = prev.experiments.map((e) => ({
    ...e,
    progressPct: Math.min(100, e.progressPct + rng() * 0.02 * dt),
  }))
  // inhabitants shuffle rarely; warheads change essentially never (and only twitch by one)
  const inhabitants = rng() < 0.001 * dt ? prev.inhabitants + (rng() < 0.5 ? -1 : 1) : prev.inhabitants
  const nukesArmed = rng() < 0.0001 * dt ? Math.max(0, prev.nukesArmed + (rng() < 0.5 ? -1 : 1)) : prev.nukesArmed
  const powerMW = Math.max(1, prev.powerMW + (rng() - 0.5) * 0.4 * dt)
  return { inhabitants, oxygenPct, powerMW, nukesArmed, experiments }
}
