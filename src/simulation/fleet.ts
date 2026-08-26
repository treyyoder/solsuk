import { ORBIT_BASE_PERIOD, ORBIT_MAX_RADIUS, ORBIT_MAX_TILT, ORBIT_MIN_RADIUS } from './constants'
import type { SatelliteConfig } from './types'
import { mulberry32 } from '../utils/random'
import { GROUND_STATIONS } from './groundStations'

const CALLSIGNS = [
  'Helios', 'Aurora', 'Zenith', 'Vanta', 'Kestrel', 'Umbra', 'Corona', 'Nadir',
  'Bastion', 'Vector', 'Cinder', 'Halcyon', 'Meridian', 'Pallas', 'Quasar', 'Rigel',
]

const frac = (x: number) => x - Math.floor(x)

/**
 * One deterministic orbit slot per index, spread by additive quasi-random
 * sequences with INDEPENDENT irrational steps per dimension — correlated
 * steps (e.g. all multiples of the golden angle) collapse the slots onto a
 * lattice line and the fleet bunches into trains. With decorrelated
 * dimensions any fleet size fills the shell quasi-uniformly: no two
 * satellites share an orbit and neighbors keep their distance — the
 * constellation is deconflicted by construction, and every slot's plane
 * rides the sun line (always sunlit; see orbits.ts).
 */
export function slotFor(i: number): Pick<SatelliteConfig, 'radius' | 'tilt' | 'azimuth' | 'phase' | 'angVel'> {
  const n = i + 1
  const radius = ORBIT_MIN_RADIUS + (ORBIT_MAX_RADIUS - ORBIT_MIN_RADIUS) * frac(n * 0.6180339887498949) // φ−1
  // sqrt spreads tilts evenly over the cone's solid angle
  const tilt = ORBIT_MAX_TILT * Math.sqrt(frac(n * 0.4142135623730951)) // √2−1
  const azimuth = 2 * Math.PI * frac(n * 0.7320508075688772) // √3−1
  const phase = 2 * Math.PI * frac(n * 0.23606797749978969) // √5−2
  const period = ORBIT_BASE_PERIOD * Math.pow(radius / ORBIT_MIN_RADIUS, 1.5)
  return { radius, tilt, azimuth, phase, angVel: (2 * Math.PI) / period }
}

export function satConfigFor(i: number): SatelliteConfig {
  const rng = mulberry32(0x501f ^ (i * 2654435761))
  const id = `SAT-${String(i + 1).padStart(4, '0')}`
  const callsign = `${CALLSIGNS[i % CALLSIGNS.length]}-${Math.floor(i / CALLSIGNS.length) + 1}`
  return {
    id,
    name: callsign,
    ...slotFor(i),
    gpuPods: 12 + Math.floor(rng() * 37),
    peakExaflops: +(0.4 + rng() * 2.2).toFixed(2),
    panelAreaM2: Math.round(1800 + rng() * 2400),
    batteryMWh: +(2 + rng() * 6).toFixed(1),
    groundStationId: GROUND_STATIONS[i % GROUND_STATIONS.length].id,
  }
}

/** Deterministic fleet of any size — index i always yields the same satellite. */
export function generateFleet(count: number): SatelliteConfig[] {
  return Array.from({ length: count }, (_, i) => satConfigFor(i))
}
