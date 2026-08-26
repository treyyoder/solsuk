import {
  EARTH_DAY,
  EARTH_TILT,
  MOON_INCLINATION,
  MOON_ORBIT_RADIUS,
  MOON_PERIOD,
  SHELLS,
  SUN_DISTANCE,
  SUN_PERIOD,
} from './constants'
import type { SatelliteConfig, Vec3 } from './types'

/**
 * Pure circular-orbit math. World frame: y-up; the ecliptic is the x-z plane.
 * All functions are allocation-light and safe to call per-frame.
 */

/** Position on an inclined circular orbit: anomaly ν in the orbital plane, plane defined by inclination + RAAN. */
export function orbitPosition(radius: number, inclination: number, raan: number, anomaly: number, out: Vec3): Vec3 {
  const cosNu = Math.cos(anomaly)
  const sinNu = Math.sin(anomaly)
  // in-plane coordinates → rotate by inclination about x → rotate by RAAN about y
  const xp = radius * cosNu
  const zp = radius * sinNu
  const y = zp * Math.sin(inclination)
  const zi = zp * Math.cos(inclination)
  const cosR = Math.cos(raan)
  const sinR = Math.sin(raan)
  out[0] = xp * cosR + zi * sinR
  out[1] = y
  out[2] = -xp * sinR + zi * cosR
  return out
}

export function satPosition(sat: SatelliteConfig, t: number, out: Vec3): Vec3 {
  const shell = SHELLS[sat.shell]
  const anomaly = sat.phase + (t / shell.period) * Math.PI * 2
  return orbitPosition(shell.radius, shell.inclination, shell.raan + sat.raanOffset, anomaly, out)
}

export function moonPosition(t: number, out: Vec3): Vec3 {
  const anomaly = (t / MOON_PERIOD) * Math.PI * 2 + 0.8
  return orbitPosition(MOON_ORBIT_RADIUS, MOON_INCLINATION, 1.2, anomaly, out)
}

/** Unit vector from origin toward the sun; precesses slowly around the ecliptic. */
export function sunDirection(t: number, out: Vec3): Vec3 {
  const a = (t / SUN_PERIOD) * Math.PI * 2 + 0.6
  out[0] = Math.cos(a)
  out[1] = 0
  out[2] = Math.sin(a)
  return out
}

export function sunPosition(t: number, out: Vec3): Vec3 {
  sunDirection(t, out)
  out[0] *= SUN_DISTANCE
  out[1] *= SUN_DISTANCE
  out[2] *= SUN_DISTANCE
  return out
}

/** Earth rotation angle about its (tilted) axis. */
export function earthRotation(t: number): number {
  return (t / EARTH_DAY) * Math.PI * 2
}

export { EARTH_TILT }

/** lat/lon (degrees) on a sphere of radius r → body-frame position (before body rotation). */
export function latLonToVec(latDeg: number, lonDeg: number, r: number, out: Vec3): Vec3 {
  const lat = (latDeg * Math.PI) / 180
  const lon = (lonDeg * Math.PI) / 180
  out[0] = r * Math.cos(lat) * Math.cos(lon)
  out[1] = r * Math.sin(lat)
  out[2] = -r * Math.cos(lat) * Math.sin(lon)
  return out
}
