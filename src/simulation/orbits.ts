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
 *
 * simClock.t only ever grows (it's a running real-time clock, and at high
 * speed levels it grows FAST — see utils/time.ts). Every periodic quantity
 * here reduces t modulo its own period BEFORE any multiply/divide that would
 * otherwise build a huge intermediate value: once an angle's raw magnitude
 * exceeds roughly 2^52, a double can no longer represent it to sub-2π
 * precision, so per-frame changes stop tracing a smooth orbit and start
 * sampling the periodic function at effectively uncorrelated points — and
 * small fixed offsets (like the tangent-direction trick a naive
 * "position a moment later" sample relies on) get silently swallowed
 * entirely (t + 0.25 === t once t is large enough). Wrapping first keeps
 * every trig argument bounded to one period, however large t itself grows.
 */
function wrapTime(t: number, period: number): number {
  const r = t % period
  return r < 0 ? r + period : r
}

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
/** Builds the sun-riding orbit's in-plane basis (a, b) into aScratch/bScratch — shared by position and tangent. */
function satBasis(sat: SatelliteConfig, sunDir: Vec3): void {
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
}

function satTheta(sat: SatelliteConfig, t: number): number {
  const period = (2 * Math.PI) / sat.angVel
  return sat.phase + wrapTime(t, period) * sat.angVel
}

export function satPosition(sat: SatelliteConfig, t: number, sunDir: Vec3, out: Vec3): Vec3 {
  satBasis(sat, sunDir)
  return satPositionAtTheta(sat, satTheta(sat, t), out)
}

/** Position at an explicit orbital angle — for sweeping a full ring (e.g. an
 * orbit-preview line) without going through time-based phase arithmetic,
 * which would otherwise mix a huge t-derived term back in. Call satBasis
 * first (satPosition does this for you; direct callers must do it themselves). */
export function satPositionAtTheta(sat: SatelliteConfig, theta: number, out: Vec3): Vec3 {
  const cth = Math.cos(theta) * sat.radius
  const sth = Math.sin(theta) * sat.radius
  out[0] = aScratch[0] * cth + bScratch[0] * sth
  out[1] = aScratch[1] * cth + bScratch[1] * sth
  out[2] = aScratch[2] * cth + bScratch[2] * sth
  return out
}

/** Basis-build entry point for callers that need satPositionAtTheta directly (e.g. sweeping a ring). */
export function computeSatBasis(sat: SatelliteConfig, sunDir: Vec3): void {
  satBasis(sat, sunDir)
}

/**
 * Position AND unit along-track tangent in one basis pass — the tangent is
 * the analytic derivative d/dθ of the position formula, not a second sample
 * at "t plus a moment," which silently degenerates to zero once t's
 * magnitude swallows that small offset (see the module comment above).
 */
export function satPositionAndTangent(sat: SatelliteConfig, t: number, sunDir: Vec3, outPos: Vec3, outTangent: Vec3): void {
  satBasis(sat, sunDir)
  const theta = satTheta(sat, t)
  const cth = Math.cos(theta)
  const sth = Math.sin(theta)
  const ax = aScratch[0]
  const ay = aScratch[1]
  const az = aScratch[2]
  const bx = bScratch[0]
  const by = bScratch[1]
  const bz = bScratch[2]
  outPos[0] = ax * cth * sat.radius + bx * sth * sat.radius
  outPos[1] = ay * cth * sat.radius + by * sth * sat.radius
  outPos[2] = az * cth * sat.radius + bz * sth * sat.radius
  // d/dθ (cosθ·a + sinθ·b) = -sinθ·a + cosθ·b — already unit length (a,b orthonormal)
  outTangent[0] = -sth * ax + cth * bx
  outTangent[1] = -sth * ay + cth * by
  outTangent[2] = -sth * az + cth * bz
}

export function moonPosition(t: number, out: Vec3): Vec3 {
  const anomaly = (wrapTime(t, MOON_PERIOD) / MOON_PERIOD) * Math.PI * 2 + 0.8
  return orbitPosition(MOON_ORBIT_RADIUS, MOON_INCLINATION, 1.2, anomaly, out)
}

/** Unit vector from origin toward the sun; precesses slowly around the ecliptic. */
export function sunDirection(t: number, out: Vec3): Vec3 {
  const a = (wrapTime(t, SUN_PERIOD) / SUN_PERIOD) * Math.PI * 2 + 0.6
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
  return (wrapTime(t, EARTH_DAY) / EARTH_DAY) * Math.PI * 2
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
