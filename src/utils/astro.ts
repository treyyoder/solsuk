/** B–V color index → approximate RGB (blackbody-ish tint for stars). */
export function bvToRGB(bv: number): [number, number, number] {
  const t = Math.max(-0.4, Math.min(2.0, bv))
  // piecewise fit: hot blue → white → yellow → orange-red
  let r: number
  let g: number
  let b: number
  if (t < 0.4) {
    r = 0.62 + t * 0.9
    g = 0.72 + t * 0.6
    b = 1.0
  } else if (t < 1.0) {
    r = 1.0
    g = 0.96 - (t - 0.4) * 0.25
    b = 1.0 - (t - 0.4) * 0.9
  } else {
    r = 1.0
    g = 0.81 - (t - 1.0) * 0.4
    b = 0.46 - (t - 1.0) * 0.3
  }
  return [Math.min(1, r), Math.min(1, Math.max(0.2, g)), Math.min(1, Math.max(0.1, b))]
}
