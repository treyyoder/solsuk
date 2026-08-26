export type SatId = string // 'SAT-01' … 'SAT-48'

export type Vec3 = [number, number, number]

export interface SatelliteConfig {
  id: SatId
  name: string
  /** orbit slot — sun-riding deconflicted constellation (see constants.ts) */
  radius: number
  /** tilt of the orbit normal away from the sun line, radians */
  tilt: number
  /** azimuth of that tilt around the sun line, radians */
  azimuth: number
  /** phase along the orbit, radians */
  phase: number
  /** angular velocity, rad per simTime second */
  angVel: number
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
