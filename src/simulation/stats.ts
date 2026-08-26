import type { Crosslink, MoonBaseStats, SatelliteConfig, SatelliteStats, Vec3 } from './types'
import { GROUND_STATIONS, slantRange, stationVisible } from './groundStations'

/**
 * Stat evolution, ticked at ~10 Hz by the sim loop. Pure: (prev, env, dt) → next.
 * Numbers are fictional but internally consistent.
 */

const SOLAR_KW_PER_M2 = 0.29 // panel output at 1 AU with cell efficiency folded in
const TRACKING_COS = 0.93 // single-axis sun tracking keeps incidence near-optimal

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
): SatelliteStats {
  // --- compute: mean-reverting utilization random walk ---
  const lowBattery = prev.batteryPct < 20
  const target = lowBattery ? 0.25 : 0.72
  let utilization = prev.utilization + (target - prev.utilization) * 0.02 * dt + (rng() - 0.5) * 0.045 * Math.sqrt(dt)
  utilization = Math.max(0.05, Math.min(0.99, utilization))
  const effectiveExaflops = cfg.peakExaflops * utilization
  const activeJobs = Math.max(4, Math.round(prev.activeJobs + (rng() - 0.5 + (utilization - 0.7) * 0.4) * 24 * dt))
  const tempC = prev.tempC + ((14 + utilization * 42 - prev.tempC) * 0.05 + (rng() - 0.5) * 0.3) * dt

  // --- solar / battery ---
  const solarMW = (cfg.panelAreaM2 * SOLAR_KW_PER_M2 * illum * TRACKING_COS) / 1000
  const loadMW = 0.25 + utilization * (cfg.gpuPods * 0.028)
  const netMW = solarMW - loadMW
  const batteryPct = Math.max(0, Math.min(100, prev.batteryPct + ((netMW * dt) / 3600 / cfg.batteryMWh) * 100 * 60))

  // --- transmission ---
  const station = GROUND_STATIONS.find((g) => g.id === cfg.groundStationId)!
  const groundVisible = stationVisible(station, pos, t)
  const range = slantRange(station, pos, t)
  const downlinkGbps = groundVisible ? +(240 / (1 + range * 0.4) + rng() * 8).toFixed(1) : 0
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
