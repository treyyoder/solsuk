import { EARTH_RADIUS } from './constants'
import type { Vec3 } from './types'

/**
 * Earth-shadow test: cylinder of radius EARTH_RADIUS extending anti-sunward.
 * Returns illumination 0..1 with a smooth penumbra band so solar output ramps
 * instead of snapping.
 */
export function illumination(pos: Vec3, sunDir: Vec3): number {
  // component of pos along the sun direction
  const along = pos[0] * sunDir[0] + pos[1] * sunDir[1] + pos[2] * sunDir[2]
  if (along >= 0) return 1 // sunward hemisphere is always lit
  // radial distance from the shadow axis
  const px = pos[0] - along * sunDir[0]
  const py = pos[1] - along * sunDir[1]
  const pz = pos[2] - along * sunDir[2]
  const radial = Math.hypot(px, py, pz)
  const penumbra = 0.18
  // radial < R → umbra; smooth ramp across [R, R+penumbra]
  return smoothstep(EARTH_RADIUS, EARTH_RADIUS + penumbra, radial)
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
