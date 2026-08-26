import {
  EARTH_DAY,
  EARTH_TILT,
  MOON_INCLINATION,
  MOON_ORBIT_RADIUS,
  MOON_PERIOD,
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

const nScratch: Vec3 = [0, 0, 0]
const aScratch: Vec3 = [0, 0, 0]
const bScratch: Vec3 = [0, 0, 0]

/**
 * Sun-riding orbit: the orbit plane's normal is the sun direction tilted by
 * `sat.tilt` (rotated `sat.azimuth` about the sun line). Because the plane
 * follows the sun as it precesses, the satellite NEVER enters Earth's shadow —
 * this is the "always in sunlight" guarantee. Unique (radius, tilt, azimuth,
 * phase) slots per satellite keep the constellation deconflicted.
 */
export function satPosition(sat: SatelliteConfig, t: number, sunDir: Vec3, out: Vec3): Vec3 {
  // u,v ⊥ sunDir (sunDir lives in the ecliptic plane, so worldY is safe)
  // u = sunDir × Y, v = sunDir × u
  const ux = -sunDir[2]
  const uz = sunDir[0]
  // (u normalized already: |sunDir|=1, y=0)
  const vx = sunDir[1] * uz - 0
  const vy = sunDir[2] * ux - sunDir[0] * uz
  const vz = 0 - sunDir[1] * ux
  // orbit normal n = sunDir tilted by `tilt` toward cos(az)·u + sin(az)·v
  const st = Math.sin(sat.tilt)
  const ct = Math.cos(sat.tilt)
  const ca = Math.cos(sat.azimuth)
  const sa = Math.sin(sat.azimuth)
  nScratch[0] = sunDir[0] * ct + (ca * ux + sa * vx) * st
  nScratch[1] = sunDir[1] * ct + (ca * 0 + sa * vy) * st
  nScratch[2] = sunDir[2] * ct + (ca * uz + sa * vz) * st
  // in-plane basis: a = n × Y (or n × X when degenerate), b = n × a
  let ax = nScratch[2]
  let ay = 0
  let az = -nScratch[0]
  let alen = Math.hypot(ax, ay, az)
  if (alen < 1e-4) {
    ax = 0
    ay = nScratch[2]
    az = -nScratch[1]
    alen = Math.hypot(ax, ay, az)
  }
  ax /= alen
  ay /= alen
  az /= alen
  aScratch[0] = ax
  aScratch[1] = ay
  aScratch[2] = az
  bScratch[0] = nScratch[1] * az - nScratch[2] * ay
  bScratch[1] = nScratch[2] * ax - nScratch[0] * az
  bScratch[2] = nScratch[0] * ay - nScratch[1] * ax
  const theta = sat.phase + t * sat.angVel
  const cth = Math.cos(theta) * sat.radius
  const sth = Math.sin(theta) * sat.radius
  out[0] = ax * cth + bScratch[0] * sth
  out[1] = ay * cth + bScratch[1] * sth
  out[2] = az * cth + bScratch[2] * sth
  return out
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
