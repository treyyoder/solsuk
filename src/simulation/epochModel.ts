/**
 * The future-history growth model: 2026 experimental 150 kW platforms →
 * 2084 planetary-scale orbital compute. Everything is keyframed and
 * interpolated in log space (piecewise-exponential S-curve segments), and
 * every assumption lives in SimConfig so the whole trajectory can be
 * recomputed under different beliefs. This module is pure — no three.js,
 * no react, no stores.
 *
 * Calibration notes: compute-per-watt follows the spec's own examples
 * (deliberately conservative "sustained useful AI FLOPS", well below
 * chip-datasheet numbers), tuned so the milestone list lands where the
 * spec puts it: EFLOP-class largest facility ~2034, first 1 GW facility
 * 2040, first ZFLOP-class system ~2050, YFLOP-class network total by the
 * mid-2060s.
 */

export type FacilityClass = 'pioneer' | 'cluster' | 'edge' | 'standard' | 'hyper' | 'giga'

export const FACILITY_CLASSES: FacilityClass[] = ['pioneer', 'cluster', 'edge', 'standard', 'hyper', 'giga']

export interface ClassMeta {
  id: FacilityClass
  label: string
  short: string
  /** id prefix for facility ids, e.g. GIG-0001 */
  prefix: string
  color: string
  /** relative visual size multiplier (log-ish so pioneers stay visible) */
  visualScale: number
  purpose: string
}

export const CLASS_META: Record<FacilityClass, ClassMeta> = {
  pioneer: {
    id: 'pioneer',
    label: 'Pioneer Platform',
    short: 'GEN-1',
    prefix: 'PIO',
    color: '#9fb6cc',
    visualScale: 1,
    purpose: 'Experimental orbital compute: AI inference, Earth-observation processing, comms',
  },
  cluster: {
    id: 'cluster',
    label: 'Cluster Node',
    short: 'GEN-2',
    prefix: 'CLU',
    color: '#6fe3d2',
    visualScale: 1.5,
    purpose: 'Dedicated accelerator modules, optical crosslinks, early orbital clusters',
  },
  edge: {
    id: 'edge',
    label: 'Edge Compute Node',
    short: 'EDGE',
    prefix: 'EDG',
    color: '#4da6ff',
    visualScale: 2.2,
    purpose: 'Satellite processing, low-latency orbital applications, AI inference',
  },
  standard: {
    id: 'standard',
    label: 'Orbital Data Center',
    short: 'STD',
    prefix: 'ODC',
    color: '#39ff8e',
    visualScale: 3.4,
    purpose: 'AI training and inference, scientific computing, large orbital workloads',
  },
  hyper: {
    id: 'hyper',
    label: 'Hyperscale Complex',
    short: 'HYPER',
    prefix: 'HYP',
    color: '#b44cff',
    visualScale: 5.2,
    purpose: 'Massive distributed AI clusters, scientific simulation, model training',
  },
  giga: {
    id: 'giga',
    label: 'Gigawatt Complex',
    short: 'GIGA',
    prefix: 'GIG',
    color: '#ffb454',
    visualScale: 8.5,
    purpose: 'Distributed modular gigawatt-class infrastructure — a city block of compute',
  },
}

/** hard rendering-capacity caps per class (instanced mesh allocation) */
export const CLASS_CAPACITY: Record<FacilityClass, number> = {
  pioneer: 24,
  cluster: 220,
  edge: 20000,
  standard: 8800,
  hyper: 3300,
  giga: 560,
}

export const START_YEAR = 2026
export const END_YEAR = 2084
export const YEAR_SECONDS = 365.25 * 86400

// ---------------------------------------------------------------- config

export interface SimConfig {
  /** multiplies facility population across all classes */
  growthMultiplier: number
  /** multiplies compute-per-watt (technological-efficiency assumption) */
  computeEffMultiplier: number
  /** additive solar-cell efficiency bonus, percentage points */
  solarEffBonusPct: number
  /** end-to-end electrical system efficiency (conversion/transmission/storage/orientation/degradation/redundancy) */
  systemEff: number
  /** radiator surface temperature, K (Stefan–Boltzmann) */
  radiatorTempK: number
  radiatorEmissivity: number
  /** multiplies infrastructure mass per MW */
  massMultiplier: number
  /** multiplies all network bandwidths */
  bandwidthMultiplier: number
  /** FP16 TFLOPS of one "GPU equivalent" for the accelerator-count stat */
  gpuEquivTFLOPS: number
  /** manual +LAUNCH additions on top of the model, per class */
  extraFacilities: Record<FacilityClass, number>
}

export const DEFAULT_CONFIG: SimConfig = {
  growthMultiplier: 1,
  computeEffMultiplier: 1,
  solarEffBonusPct: 0,
  systemEff: 0.72,
  radiatorTempK: 340,
  radiatorEmissivity: 0.92,
  massMultiplier: 1,
  bandwidthMultiplier: 1,
  gpuEquivTFLOPS: 2000,
  extraFacilities: { pioneer: 0, cluster: 0, edge: 0, standard: 0, hyper: 0, giga: 0 },
}

// ---------------------------------------------------------------- interpolation

type Keyframes = [year: number, value: number][]

/** piecewise log-linear (values <= 0 handled linearly) — smooth exponential segments */
function interp(frames: Keyframes, year: number): number {
  if (year <= frames[0][0]) return frames[0][1]
  const last = frames[frames.length - 1]
  if (year >= last[0]) return last[1]
  for (let i = 0; i < frames.length - 1; i++) {
    const [y0, v0] = frames[i]
    const [y1, v1] = frames[i + 1]
    if (year >= y0 && year <= y1) {
      const t = (year - y0) / (y1 - y0)
      if (v0 > 0 && v1 > 0) return Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * t)
      return v0 + (v1 - v0) * t
    }
  }
  return last[1]
}

// ---------------------------------------------------------------- population keyframes

/** facility counts per class — sums hit the spec's totals: 16 (2030), 64 (2033),
 * 256 (2035), 1024 (2040), 4096 (2054), 16384 (2064), saturating ~30k by 2084 */
const CLASS_COUNTS: Record<FacilityClass, Keyframes> = {
  // empty sky until the first platform launches in 2027
  pioneer: [[2026.999, 0], [2027, 1], [2028, 6], [2030, 16], [2033, 20], [2035, 16], [2084, 16]],
  cluster: [[2031, 0], [2033, 44], [2035, 102], [2040, 47], [2054, 40], [2064, 90], [2084, 150]],
  edge: [[2033.5, 0], [2035, 138], [2040, 540], [2047, 1100], [2054, 2300], [2064, 9978], [2074, 14000], [2084, 18334]],
  standard: [[2035.5, 0], [2040, 300], [2047, 700], [2054, 1200], [2064, 4500], [2074, 6500], [2084, 8000]],
  hyper: [[2036.5, 0], [2040, 120], [2047, 260], [2054, 500], [2064, 1600], [2074, 2400], [2084, 3000]],
  giga: [[2039.7, 0], [2040, 1], [2047, 12], [2054, 40], [2064, 200], [2074, 350], [2084, 500]],
}

/** electrical power band per class, MW, as a function of COMMISSION year —
 * later builds of the big classes are bigger (launch economics, robotics,
 * orbital assembly). min/max both interpolated. */
const CLASS_POWER_MIN: Record<FacilityClass, Keyframes> = {
  pioneer: [[2026, 0.1]],
  cluster: [[2031, 0.25]],
  edge: [[2033, 1]],
  standard: [[2035, 10]],
  hyper: [[2036, 100], [2054, 180], [2064, 350], [2084, 500]],
  giga: [[2040, 1000], [2064, 2000], [2084, 3000]],
}
const CLASS_POWER_MAX: Record<FacilityClass, Keyframes> = {
  pioneer: [[2026, 0.2]],
  cluster: [[2031, 1]],
  edge: [[2033, 10]],
  standard: [[2035, 100]],
  hyper: [[2036, 300], [2040, 500], [2054, 2000], [2064, 5000], [2084, 6000]],
  giga: [[2040, 1000], [2047, 3000], [2054, 5000], [2064, 12000], [2084, 20000]],
}

// ---------------------------------------------------------------- technology curves

/** FP16 "sustained useful AI compute" per electrical kW, TFLOPS (system level) */
const COMPUTE_EFF: Keyframes = [
  [2026, 25], [2030, 40], [2033, 120], [2035, 250], [2040, 320],
  [2047, 370], [2054, 420], [2064, 550], [2074, 700], [2084, 900],
]

/** solar cell efficiency, fraction */
const SOLAR_EFF: Keyframes = [
  [2026, 0.32], [2030, 0.35], [2040, 0.43], [2050, 0.47], [2060, 0.51], [2084, 0.56],
]

/** infrastructure mass, metric tons per electrical MW */
const MASS_PER_MW: Keyframes = [
  [2026, 90], [2035, 55], [2040, 40], [2054, 28], [2064, 22], [2084, 15],
]

/** optical inter-satellite link capacity per facility, Gbps */
const INTERSAT_PER_FAC: Keyframes = [
  [2026, 0], [2030, 5], [2033, 100], [2040, 1e4], [2054, 1e6], [2064, 1e7], [2084, 1e8],
]

/** total Earth↔orbit connectivity, Gbps */
const EARTH_LINK_TOTAL: Keyframes = [
  [2026, 50], [2030, 400], [2035, 2e4], [2040, 5e5], [2054, 2e7], [2064, 3e8], [2084, 3e9],
]

/** internal compute-fabric bandwidth per electrical MW, Tbps */
const FABRIC_PER_MW: Keyframes = [
  [2026, 10], [2040, 400], [2064, 5e4], [2084, 5e5],
]

export const SOLAR_FLUX_W_M2 = 1361
const STEFAN_BOLTZMANN = 5.670374419e-8

// ---------------------------------------------------------------- public API

export function classCount(cls: FacilityClass, year: number, config: SimConfig): number {
  const base = interp(CLASS_COUNTS[cls], year) * config.growthMultiplier
  const extra = config.extraFacilities[cls] ?? 0
  return Math.min(CLASS_CAPACITY[cls], Math.round(base) + extra)
}

/** the year at which facility k (0-based) of a class was commissioned — the
 * inverse of the count curve, found by bisection over the piecewise-log curve.
 * Memoized: it sits inside the per-facility aggregate loops. */
const commissionCache = new Map<string, number>()

export function commissionYear(cls: FacilityClass, k: number, config: SimConfig): number {
  const key = `${cls}|${k}|${config.growthMultiplier}|${config.extraFacilities[cls] ?? 0}`
  const hit = commissionCache.get(key)
  if (hit !== undefined) return hit
  if (commissionCache.size > 120000) commissionCache.clear()
  const target = k + 1
  let lo = START_YEAR
  let hi = END_YEAR
  let result = hi
  if (interp(CLASS_COUNTS[cls], hi) * config.growthMultiplier >= target) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (interp(CLASS_COUNTS[cls], mid) * config.growthMultiplier >= target) hi = mid
      else lo = mid
    }
    result = hi
  }
  commissionCache.set(key, result)
  return result
}

export function powerBandMW(cls: FacilityClass, commissionedYear: number): [number, number] {
  return [interp(CLASS_POWER_MIN[cls], commissionedYear), interp(CLASS_POWER_MAX[cls], commissionedYear)]
}

export function computeEffTFperKW(year: number, config: SimConfig): number {
  return interp(COMPUTE_EFF, year) * config.computeEffMultiplier
}

export function solarEfficiency(year: number, config: SimConfig): number {
  return Math.min(0.72, interp(SOLAR_EFF, year) + config.solarEffBonusPct / 100)
}

/** m² of solar array needed for a given electrical power */
export function solarAreaM2(powerMW: number, year: number, config: SimConfig): number {
  return (powerMW * 1e6) / (SOLAR_FLUX_W_M2 * solarEfficiency(year, config) * config.systemEff)
}

/** m² of (two-sided) radiator needed to reject a given thermal power */
export function radiatorAreaM2(powerMW: number, config: SimConfig): number {
  const wPerM2 = 2 * config.radiatorEmissivity * STEFAN_BOLTZMANN * Math.pow(config.radiatorTempK, 4)
  return (powerMW * 1e6) / wPerM2
}

export interface EpochState {
  year: number
  counts: Record<FacilityClass, number>
  totalCount: number
  totalPowerMW: number
  avgPowerMW: number
  largestPowerMW: number
  /** total FP16 compute, EFLOPS */
  totalComputeEF: number
  largestComputeEF: number
  computeEffTFperKW: number
  solarEffPct: number
  totalSolarAreaKm2: number
  totalRadiatorAreaKm2: number
  gpuEquivalents: number
  totalMassTons: number
  interSatGbps: number
  earthLinkGbps: number
  /** largest facility's internal fabric, Tbps */
  largestFabricTbps: number
}

/** deterministic per-facility power draw (stable under scrubbing) */
export function facilityPowerMW(cls: FacilityClass, k: number, config: SimConfig): number {
  const cy = commissionYear(cls, k, config)
  const [lo, hi] = powerBandMW(cls, cy)
  // deterministic pseudo-random in [0,1), biased toward the low end (^1.4);
  // a sprinkling of near-max flagships
  const salt = FACILITY_CLASSES.indexOf(cls) + 1
  const h = fract(Math.sin((k + 1) * 127.1 + salt * 311.7) * 43758.5453)
  const frac = h > 0.93 ? 0.9 + (h - 0.93) : Math.pow(h, 1.4)
  return lo + (hi - lo) * frac
}

const fract = (x: number) => x - Math.floor(x)

/** class-total power via a coarse per-facility sum (cheap: counts × sampled)
 * — exact enough for dashboard aggregates without touching the fleet array */
function classTotalPowerMW(cls: FacilityClass, count: number, config: SimConfig): { total: number; largest: number } {
  let total = 0
  let largest = 0
  for (let k = 0; k < count; k++) {
    const p = facilityPowerMW(cls, k, config)
    total += p
    if (p > largest) largest = p
  }
  return { total, largest }
}

const epochCache = new Map<string, EpochState>()

export function computeEpoch(year: number, config: SimConfig): EpochState {
  const y = Math.max(START_YEAR, Math.min(END_YEAR, year))
  const key = `${y.toFixed(2)}|${JSON.stringify(config)}`
  const hit = epochCache.get(key)
  if (hit) return hit
  if (epochCache.size > 400) epochCache.clear()

  const counts = {} as Record<FacilityClass, number>
  let totalCount = 0
  let totalPowerMW = 0
  let largestPowerMW = 0
  for (const cls of FACILITY_CLASSES) {
    const n = classCount(cls, y, config)
    counts[cls] = n
    totalCount += n
    const { total, largest } = classTotalPowerMW(cls, n, config)
    totalPowerMW += total
    if (largest > largestPowerMW) largestPowerMW = largest
  }

  const eff = computeEffTFperKW(y, config)
  const totalComputeEF = (totalPowerMW * 1000 * eff) / 1e6
  const largestComputeEF = (largestPowerMW * 1000 * eff) / 1e6
  const bw = config.bandwidthMultiplier

  const state: EpochState = {
    year: y,
    counts,
    totalCount,
    totalPowerMW,
    avgPowerMW: totalCount > 0 ? totalPowerMW / totalCount : 0,
    largestPowerMW,
    totalComputeEF,
    largestComputeEF,
    computeEffTFperKW: eff,
    solarEffPct: solarEfficiency(y, config) * 100,
    totalSolarAreaKm2: solarAreaM2(totalPowerMW, y, config) / 1e6,
    totalRadiatorAreaKm2: radiatorAreaM2(totalPowerMW, config) / 1e6,
    gpuEquivalents: (totalComputeEF * 1e6) / config.gpuEquivTFLOPS,
    totalMassTons: totalPowerMW * interp(MASS_PER_MW, y) * config.massMultiplier,
    interSatGbps: interp(INTERSAT_PER_FAC, y) * totalCount * 2 * bw,
    earthLinkGbps: interp(EARTH_LINK_TOTAL, y) * bw,
    largestFabricTbps: largestPowerMW * interp(FABRIC_PER_MW, y) * bw,
  }
  epochCache.set(key, state)
  return state
}

export function fabricTbpsForPower(powerMW: number, year: number, config: SimConfig): number {
  return powerMW * interp(FABRIC_PER_MW, year) * config.bandwidthMultiplier
}

// ---------------------------------------------------------------- milestones

export interface Milestone {
  year: number
  title: string
  sub?: string
  /** focus the newest facility of this class when the user hits VIEW */
  focusClass?: FacilityClass
}

export const MILESTONES: Milestone[] = [
  { year: 2027, title: 'First experimental orbital compute platform', sub: '~150 kW · PFLOPS-class', focusClass: 'pioneer' },
  { year: 2030, title: 'First commercial orbital GPU data center', sub: '16 platforms on orbit', focusClass: 'pioneer' },
  { year: 2033, title: 'First 1 MW orbital compute facility', sub: 'Optical inter-satellite links come online', focusClass: 'cluster' },
  { year: 2034, title: 'First orbital EFLOP-class AI cluster', focusClass: 'cluster' },
  { year: 2036, title: 'First 10 MW orbital data center', sub: 'Multi-spacecraft logical facilities', focusClass: 'edge' },
  { year: 2038, title: 'First 100 MW orbital compute complex', focusClass: 'hyper' },
  { year: 2040, title: 'First 1 GW orbital data center', sub: 'Orbital compute becomes industrial infrastructure', focusClass: 'giga' },
  { year: 2045, title: 'First orbital compute region exceeding 10 GW', sub: 'Availability zones · autonomous workload migration', focusClass: 'giga' },
  { year: 2050, title: 'First ZFLOP-class orbital AI system', focusClass: 'giga' },
  { year: 2054, title: '4,096 orbital data centers', sub: 'Interconnected compute regions' },
  { year: 2060, title: 'First 10 GW orbital compute complex', focusClass: 'giga' },
  { year: 2064, title: '16,384 orbital data centers', sub: 'A planetary-scale computing layer' },
  { year: 2075, title: 'Network compute crosses 1 YFLOPS', sub: 'Distributed across the whole constellation' },
]

export const TIMELINE_JUMPS = [2026, 2030, 2035, 2040, 2050, 2060, 2070, 2084]

// ---------------------------------------------------------------- formatters

export function fmtPowerMW(mw: number): string {
  if (mw < 1) return `${(mw * 1000).toFixed(0)} kW`
  if (mw < 1000) return `${mw.toFixed(mw < 10 ? 1 : 0)} MW`
  if (mw < 1e6) return `${(mw / 1000).toFixed(2)} GW`
  return `${(mw / 1e6).toFixed(2)} TW`
}

export function fmtFlopsEF(ef: number): string {
  if (ef < 1e-6) return `${(ef * 1e9).toFixed(1)} TFLOPS`
  if (ef < 1e-3) return `${(ef * 1e6).toFixed(1)} PFLOPS`
  if (ef < 1) return `${(ef * 1e3).toFixed(1)} PFLOPS`
  if (ef < 1000) return `${ef.toFixed(ef < 10 ? 2 : 1)} EFLOPS`
  if (ef < 1e6) return `${(ef / 1000).toFixed(2)} ZFLOPS`
  return `${(ef / 1e6).toFixed(2)} YFLOPS`
}

export function fmtAreaM2(m2: number): string {
  if (m2 < 1e5) return `${Math.round(m2).toLocaleString()} m²`
  return `${(m2 / 1e6).toFixed(m2 < 1e7 ? 2 : 1)} km²`
}

export function fmtBandwidthGbps(gbps: number): string {
  if (gbps < 1000) return `${gbps.toFixed(gbps < 10 ? 1 : 0)} Gbps`
  if (gbps < 1e6) return `${(gbps / 1e3).toFixed(1)} Tbps`
  if (gbps < 1e9) return `${(gbps / 1e6).toFixed(1)} Pbps`
  return `${(gbps / 1e9).toFixed(1)} Ebps`
}

export function fmtMassTons(t: number): string {
  if (t < 1000) return `${t.toFixed(0)} t`
  if (t < 1e6) return `${(t / 1000).toFixed(1)} kt`
  return `${(t / 1e6).toFixed(2)} Mt`
}

export function fmtCount(n: number): string {
  if (n < 1e6) return Math.round(n).toLocaleString()
  if (n < 1e9) return `${(n / 1e6).toFixed(1)} M`
  return `${(n / 1e9).toFixed(2)} B`
}
