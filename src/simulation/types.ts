export type SatId = string // 'SAT-01' … 'SAT-48'

export type Vec3 = [number, number, number]

export interface SatelliteConfig {
  id: SatId
  name: string
  shell: 0 | 1 | 2
  /** anomaly offset within the shell plane, radians */
  phase: number
  /** RAAN spread within the shell, radians */
  raanOffset: number
  gpuPods: number
  /** peak compute, exaFLOPS */
  peakExaflops: number
  panelAreaM2: number
  batteryMWh: number
  groundStationId: string
}

export interface Crosslink {
  to: SatId
  gbps: number
}

export interface SatelliteStats {
  utilization: number // 0..1
  activeJobs: number
  effectiveExaflops: number
  tempC: number
  illumination: number // 0..1, 0 in umbra
  eclipsed: boolean
  solarMW: number
  batteryPct: number
  charging: boolean
  crosslinks: Crosslink[]
  groundVisible: boolean
  downlinkGbps: number
  latencyMs: number
}

export interface GroundStation {
  id: string
  name: string
  latDeg: number
  lonDeg: number
}

export interface ExperimentState {
  name: string
  progressPct: number
}

export interface MoonBaseConfig {
  id: string
  name: string
  latDeg: number
  lonDeg: number
  founded: number
}

export interface MoonBaseStats {
  inhabitants: number
  oxygenPct: number
  powerMW: number
  nukesArmed: number
  experiments: ExperimentState[]
}

export interface MoonStats {
  bases: Record<string, MoonBaseStats>
  totalInhabitants: number
}

export interface FleetAggregates {
  totalEffectiveEF: number
  totalSolarGW: number
  inEclipse: number
  meanUtilization: number
}

export type FocusTarget =
  | { kind: 'overview' }
  | { kind: 'earth' }
  | { kind: 'sun' }
  | { kind: 'satellite'; id: SatId }
  | { kind: 'moon'; baseId?: string }
