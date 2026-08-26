import { useMemo } from 'react'
import * as THREE from 'three'
import constellationsRaw from '../data/constellations.json'
import { CONSTELLATION_RADIUS } from '../simulation/constants'
import { useSettingsStore } from '../store/settingsStore'

interface ConstellationRow {
  id: string
  name: string
  center: [number, number, number]
  segs: [[number, number, number], [number, number, number]][]
}

export const CONSTELLATIONS = constellationsRaw as ConstellationRow[]

/** All 89 western constellation figures in one LineSegments draw call. */
export function Constellations() {
  const show = useSettingsStore((s) => s.constellationLines)

  const geometry = useMemo(() => {
    let n = 0
    for (const c of CONSTELLATIONS) n += c.segs.length
    const pos = new Float32Array(n * 6)
    let o = 0
    for (const c of CONSTELLATIONS) {
      for (const [a, b] of c.segs) {
        pos[o++] = a[0] * CONSTELLATION_RADIUS
        pos[o++] = a[1] * CONSTELLATION_RADIUS
        pos[o++] = a[2] * CONSTELLATION_RADIUS
        pos[o++] = b[0] * CONSTELLATION_RADIUS
        pos[o++] = b[1] * CONSTELLATION_RADIUS
        pos[o++] = b[2] * CONSTELLATION_RADIUS
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return geo
  }, [])

  if (!show) return null
  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial color="#3a5a7a" transparent opacity={0.28} depthWrite={false} />
    </lineSegments>
  )
}
