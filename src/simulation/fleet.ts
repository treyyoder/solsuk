import { ORBIT_BASE_PERIOD, ORBIT_MAX_TILT, ORBIT_MIN_RADIUS } from './constants'
import type { SatelliteConfig } from './types'
import {
  CLASS_META,
  commissionYear,
  facilityPowerMW,
  type FacilityClass,
  type SimConfig,
} from './epochModel'
import { activeCityCount, GROUND_STATIONS } from './groundStations'

const CALLSIGNS = [
  'Helios', 'Aurora', 'Zenith', 'Vanta', 'Kestrel', 'Umbra', 'Corona', 'Nadir',
  'Bastion', 'Vector', 'Cinder', 'Halcyon', 'Meridian', 'Pallas', 'Quasar', 'Rigel',
]

const frac = (x: number) => x - Math.floor(x)

/** big spaced offsets keep every class's slot sequence decorrelated from the others */
const SLOT_OFFSET: Record<FacilityClass, number> = {
  pioneer: 0,
  cluster: 10000,
  edge: 20000,
  standard: 60000,
  hyper: 100000,
  giga: 120000,
}

/** orbital altitude band per class — the heavy classes get the roomier outer shells */
const RADIUS_BAND: Record<FacilityClass, [number, number]> = {
  pioneer: [4.0, 4.5],
  cluster: [4.1, 4.8],
  edge: [4.2, 5.4],
  standard: [4.8, 6.0],
  hyper: [5.4, 6.4],
  giga: [6.0, 6.6],
}

/**
 * One deterministic orbit slot per (class, k), spread by additive quasi-random
 * sequences with INDEPENDENT irrational steps per dimension — correlated
 * steps collapse the slots onto a lattice line and the fleet bunches into
 * trains. Decorrelated dimensions fill each class's shell quasi-uniformly:
 * no two facilities share an orbit and neighbors keep their distance, while
 * every plane rides the sun line (always sunlit; see orbits.ts).
 */
function slotFor(cls: FacilityClass, k: number): Pick<SatelliteConfig, 'radius' | 'tilt' | 'azimuth' | 'phase' | 'angVel'> {
  const n = SLOT_OFFSET[cls] + k + 1
  const [rLo, rHi] = RADIUS_BAND[cls]
  const radius = rLo + (rHi - rLo) * frac(n * 0.6180339887498949) // φ−1
  // sqrt spreads tilts evenly over the cone's solid angle
  const tilt = ORBIT_MAX_TILT * Math.sqrt(frac(n * 0.4142135623730951)) // √2−1
  const azimuth = 2 * Math.PI * frac(n * 0.7320508075688772) // √3−1
  const phase = 2 * Math.PI * frac(n * 0.23606797749978969) // √5−2
  const period = ORBIT_BASE_PERIOD * Math.pow(radius / ORBIT_MIN_RADIUS, 1.5)
  return { radius, tilt, azimuth, phase, angVel: (2 * Math.PI) / period }
}

/** Deterministic facility — identity is (class, k); stable under timeline scrubbing. */
export function facilityConfigFor(cls: FacilityClass, k: number, config: SimConfig): SatelliteConfig {
  const meta = CLASS_META[cls]
  const id = `${meta.prefix}-${String(k + 1).padStart(4, '0')}`
  const callsign = `${CALLSIGNS[k % CALLSIGNS.length]}-${Math.floor(k / CALLSIGNS.length) + 1}`
  const commissioned = commissionYear(cls, k, config)
  return {
    id,
    name: callsign,
    cls,
    k,
    commissionYear: commissioned,
    powerMW: facilityPowerMW(cls, k, config),
    ...slotFor(cls, k),
    // home city drawn from the cities already on the net when it launched —
    // early facilities serve the megacities, later ones spread down the list
    groundStationId: GROUND_STATIONS[(SLOT_OFFSET[cls] + k) % activeCityCount(commissioned)].id,
  }
}
