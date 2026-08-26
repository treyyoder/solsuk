/** Single source of truth for world scale & timing. Stylized, not to scale. */

export const EARTH_RADIUS = 3.0
export const CLOUD_RADIUS = 3.02
export const ATMOSPHERE_RADIUS = 3.14

/** Earth's axial tilt, radians */
export const EARTH_TILT = (23.4 * Math.PI) / 180
/** seconds of simTime for one Earth rotation */
export const EARTH_DAY = 240

export const MOON_RADIUS = 0.9
export const MOON_ORBIT_RADIUS = 40
export const MOON_INCLINATION = (5.1 * Math.PI) / 180
/** seconds of simTime for one lunar orbit (stylized) */
export const MOON_PERIOD = 6500

export const SUN_DISTANCE = 300
export const SUN_VISUAL_RADIUS = 9
/** seconds of simTime for the sun direction to precess once around the ecliptic ("a year") */
export const SUN_PERIOD = 60000

export const STAR_RADIUS = 460
export const CONSTELLATION_RADIUS = 455

export const DEFAULT_TIME_SCALE = 30

export interface OrbitalShell {
  id: 0 | 1 | 2
  radius: number
  inclination: number
  /** right ascension of ascending node, radians */
  raan: number
  /** orbital period in simTime seconds */
  period: number
  count: number
}

export const SHELLS: OrbitalShell[] = [
  { id: 0, radius: 4.2, inclination: (53 * Math.PI) / 180, raan: 0.4, period: 90, count: 16 },
  { id: 1, radius: 4.8, inclination: (97 * Math.PI) / 180, raan: 2.1, period: 110, count: 16 },
  { id: 2, radius: 5.5, inclination: (30 * Math.PI) / 180, raan: 4.4, period: 135, count: 16 },
]

export const NUM_SATS = SHELLS.reduce((n, s) => n + s.count, 0)
