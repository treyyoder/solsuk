import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CITIES, stationWorldPos } from '../simulation/groundStations'
import { satData, simClock } from '../store/simStore'
import { useSettingsStore } from '../store/settingsStore'
import type { Vec3 } from '../simulation/types'

const PACKETS_PER_BEAM = 3
const cityPos: Vec3 = [0, 0, 0]

/**
 * Downlink beams: each city continuously receives from the best-placed
 * satellite overhead — a faint beam with data packets streaming down it.
 * City positions ride the rotating, tilted Earth.
 */
export function GroundLinks() {
  const markers = useRef<THREE.InstancedMesh>(null)
  const packets = useRef<THREE.InstancedMesh>(null)
  const linesRef = useRef<THREE.LineSegments>(null)
  const labels = useSettingsStore((s) => s.labels)

  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CITIES.length * 6), 3))
    return geo
  }, [])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(({ clock }) => {
    const t = simClock.t
    const posArr = satData.positions
    const n = posArr.length / 3
    const linePos = lineGeo.attributes.position.array as Float32Array
    const markerMesh = markers.current
    const packetMesh = packets.current
    if (!markerMesh || !packetMesh) return

    CITIES.forEach((city, ci) => {
      stationWorldPos(city, t, cityPos)
      const clen = Math.hypot(cityPos[0], cityPos[1], cityPos[2])
      const nx = cityPos[0] / clen
      const ny = cityPos[1] / clen
      const nz = cityPos[2] / clen

      // best satellite: highest elevation above this city's horizon
      let best = -1
      let bestDot = 0.25 // require decent elevation
      for (let j = 0; j < n; j++) {
        const dx = posArr[j * 3] - cityPos[0]
        const dy = posArr[j * 3 + 1] - cityPos[1]
        const dz = posArr[j * 3 + 2] - cityPos[2]
        const dlen = Math.hypot(dx, dy, dz)
        if (dlen < 1e-6) continue
        const d = (nx * dx + ny * dy + nz * dz) / dlen
        if (d > bestDot) {
          bestDot = d
          best = j
        }
      }

      // city marker
      dummy.position.set(cityPos[0] * 1.004, cityPos[1] * 1.004, cityPos[2] * 1.004)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      markerMesh.setMatrixAt(ci, dummy.matrix)

      if (best >= 0) {
        const sx = posArr[best * 3]
        const sy = posArr[best * 3 + 1]
        const sz = posArr[best * 3 + 2]
        linePos[ci * 6] = sx
        linePos[ci * 6 + 1] = sy
        linePos[ci * 6 + 2] = sz
        linePos[ci * 6 + 3] = cityPos[0]
        linePos[ci * 6 + 4] = cityPos[1]
        linePos[ci * 6 + 5] = cityPos[2]
        for (let k = 0; k < PACKETS_PER_BEAM; k++) {
          const u = (clock.elapsedTime * 0.35 + k / PACKETS_PER_BEAM + ci * 0.13) % 1
          dummy.position.set(
            sx + (cityPos[0] - sx) * u,
            sy + (cityPos[1] - sy) * u,
            sz + (cityPos[2] - sz) * u,
          )
          dummy.scale.setScalar(1 - u * 0.5)
          dummy.updateMatrix()
          packetMesh.setMatrixAt(ci * PACKETS_PER_BEAM + k, dummy.matrix)
        }
      } else {
        linePos.fill(0, ci * 6, ci * 6 + 6)
        for (let k = 0; k < PACKETS_PER_BEAM; k++) {
          dummy.position.set(0, 0, 0)
          dummy.scale.setScalar(0)
          dummy.updateMatrix()
          packetMesh.setMatrixAt(ci * PACKETS_PER_BEAM + k, dummy.matrix)
        }
      }
    })
    lineGeo.attributes.position.needsUpdate = true
    markerMesh.instanceMatrix.needsUpdate = true
    packetMesh.instanceMatrix.needsUpdate = true
    if (linesRef.current) linesRef.current.frustumCulled = false
  })

  return (
    <group>
      {/* beams */}
      <lineSegments ref={linesRef} geometry={lineGeo} frustumCulled={false}>
        <lineBasicMaterial color="#6fe3d2" transparent opacity={0.4} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      {/* data packets streaming to ground */}
      <instancedMesh ref={packets} args={[undefined, undefined, CITIES.length * PACKETS_PER_BEAM]} frustumCulled={false}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshBasicMaterial color="#aef3e8" toneMapped={false} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      {/* city markers */}
      <instancedMesh ref={markers} args={[undefined, undefined, CITIES.length]} frustumCulled={false}>
        <sphereGeometry args={[0.022, 10, 10]} />
        <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
      </instancedMesh>
      {labels && null /* city name labels are DOM-projected later if wanted */}
    </group>
  )
}
