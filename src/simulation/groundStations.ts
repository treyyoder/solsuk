import type { GroundStation, Vec3 } from './types'
import { EARTH_RADIUS, EARTH_TILT } from './constants'
import { earthRotation, latLonToVec } from './orbits'

/** Downlink cities — the net's data lands here. Kept deliberately short. */
export const GROUND_STATIONS: GroundStation[] = [
  { id: 'dc', name: 'Washington DC', latDeg: 38.9, lonDeg: -77.0 },
  { id: 'ny', name: 'New York', latDeg: 40.7, lonDeg: -74.0 },
  { id: 'sf', name: 'San Francisco', latDeg: 37.8, lonDeg: -122.4 },
  { id: 'london', name: 'London', latDeg: 51.5, lonDeg: -0.1 },
  { id: 'moscow', name: 'Moscow', latDeg: 55.8, lonDeg: 37.6 },
  { id: 'beijing', name: 'Beijing', latDeg: 39.9, lonDeg: 116.4 },
  { id: 'tokyo', name: 'Tokyo', latDeg: 35.7, lonDeg: 139.7 },
  { id: 'sydney', name: 'Sydney', latDeg: -33.9, lonDeg: 151.2 },
]

export const CITIES = GROUND_STATIONS

const cosTilt = Math.cos(EARTH_TILT)
const sinTilt = Math.sin(EARTH_TILT)

/** World-frame position of a city on the rotating, axially-tilted Earth
 * (matches the rendered globe: Rz(tilt) · Ry(spin) · latlon). */
export function stationWorldPos(st: GroundStation, t: number, out: Vec3): Vec3 {
  latLonToVec(st.latDeg, st.lonDeg, EARTH_RADIUS, out)
  const rot = earthRotation(t)
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const x1 = out[0] * c + out[2] * s
  const z1 = -out[0] * s + out[2] * c
  const y1 = out[1]
  out[0] = x1 * cosTilt - y1 * sinTilt
  out[1] = x1 * sinTilt + y1 * cosTilt
  out[2] = z1
  return out
}

const scratch: Vec3 = [0, 0, 0]

/** Line-of-sight: city sees the satellite when it is above the local horizon. */
export function stationVisible(st: GroundStation, satPos: Vec3, t: number): boolean {
  stationWorldPos(st, t, scratch)
  const dx = satPos[0] - scratch[0]
  const dy = satPos[1] - scratch[1]
  const dz = satPos[2] - scratch[2]
  return scratch[0] * dx + scratch[1] * dy + scratch[2] * dz > 0
}

export function slantRange(st: GroundStation, satPos: Vec3, t: number): number {
  stationWorldPos(st, t, scratch)
  return Math.hypot(satPos[0] - scratch[0], satPos[1] - scratch[1], satPos[2] - scratch[2])
}
