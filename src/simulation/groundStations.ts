import type { GroundStation, Vec3 } from './types'
import { EARTH_RADIUS } from './constants'
import { earthRotation, latLonToVec } from './orbits'

export const GROUND_STATIONS: GroundStation[] = [
  { id: 'gs-nv', name: 'Blackrock Gateway (Nevada)', latDeg: 40.8, lonDeg: -119.1 },
  { id: 'gs-is', name: 'Höfn Downlink (Iceland)', latDeg: 64.2, lonDeg: -15.2 },
  { id: 'gs-na', name: 'Karoo Array (South Africa)', latDeg: -30.7, lonDeg: 21.4 },
  { id: 'gs-au', name: 'Pilbara Relay (Australia)', latDeg: -21.0, lonDeg: 118.6 },
]

const scratch: Vec3 = [0, 0, 0]

/** World-frame position of a station on the rotating Earth (ignores axial tilt for simplicity). */
export function stationWorldPos(st: GroundStation, t: number, out: Vec3): Vec3 {
  latLonToVec(st.latDeg, st.lonDeg, EARTH_RADIUS, out)
  const rot = earthRotation(t)
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const x = out[0] * c + out[2] * s
  const z = -out[0] * s + out[2] * c
  out[0] = x
  out[2] = z
  return out
}

/** Line-of-sight: station sees the satellite when the sat is above its local horizon. */
export function stationVisible(st: GroundStation, satPos: Vec3, t: number): boolean {
  stationWorldPos(st, t, scratch)
  const dx = satPos[0] - scratch[0]
  const dy = satPos[1] - scratch[1]
  const dz = satPos[2] - scratch[2]
  // dot(stationNormal, toSat) > 0  (station normal == its position direction)
  return scratch[0] * dx + scratch[1] * dy + scratch[2] * dz > 0
}

export function slantRange(st: GroundStation, satPos: Vec3, t: number): number {
  stationWorldPos(st, t, scratch)
  return Math.hypot(satPos[0] - scratch[0], satPos[1] - scratch[1], satPos[2] - scratch[2])
}
