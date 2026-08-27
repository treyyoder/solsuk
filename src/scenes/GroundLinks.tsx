import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { activeCityCount, CITIES, MAX_CITIES, stationWorldPos } from '../simulation/groundStations'
import { getFleet, getFleetByClass, satData, simClock, yearFromT } from '../store/simStore'
import { useSettingsStore } from '../store/settingsStore'
import type { Vec3 } from '../simulation/types'

const PACKETS_PER_BEAM = 3
/** cities whose serving satellite is re-picked each frame (round-robin) */
const RETARGET_PER_FRAME = 5
/** cap on candidate scans per retarget — strided sampling above this */
const MAX_SCAN = 1200
const cityPos: Vec3 = [0, 0, 0]

/**
 * Downlink beams: every city on the net receives from the best-placed
 * inner-shell satellite overhead — a green beam with data packets streaming
 * down it. The set of served cities grows with the years (top-100 by
 * population, descending; see activeCityCount). Only the classes parked in
 * the LOW shells (pioneer/cluster/edge) serve ground directly — the heavy
 * outer platforms relay through them (see ComputeMesh).
 *
 * Perf: picking the best satellite is O(fleet) per city, so it is staggered —
 * RETARGET_PER_FRAME cities re-pick per frame from a strided sample; between
 * picks a city keeps its cached satellite (reads as a hand-off when it
 * refreshes) as long as that satellite is still above its horizon.
 */
export function GroundLinks() {
  const markers = useRef<THREE.InstancedMesh>(null)
  const packets = useRef<THREE.InstancedMesh>(null)
  const cursor = useRef(0)
  /** cached serving-satellite index per city, into the global fleet order */
  const bestSat = useMemo(() => new Int32Array(MAX_CITIES).fill(-1), [])
  const labels = useSettingsStore((s) => s.labels)
  const earthLinks = useSettingsStore((s) => s.earthLinks)

  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_CITIES * 6), 3))
    return geo
  }, [])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(({ clock }) => {
    const t = simClock.t
    const posArr = satData.positions
    const fbc = getFleetByClass()
    // downlink candidates = the inner-shell classes, a contiguous PREFIX of
    // the global fleet order (classes are concatenated pioneer→giga)
    const innerN = fbc.pioneer.length + fbc.cluster.length + fbc.edge.length
    const candN = innerN > 0 ? innerN : getFleet().length
    const active = Math.min(activeCityCount(yearFromT(t)), MAX_CITIES)
    const linePos = lineGeo.attributes.position.array as Float32Array
    const markerMesh = markers.current
    const packetMesh = packets.current
    if (!markerMesh || !packetMesh) return

    // staggered re-pick for a few cities
    if (earthLinks && active > 0 && candN > 0) {
      const stride = Math.max(1, Math.floor(candN / MAX_SCAN))
      for (let r = 0; r < RETARGET_PER_FRAME; r++) {
        const ci = (cursor.current + r) % active
        stationWorldPos(CITIES[ci], t, cityPos)
        const clen = Math.hypot(cityPos[0], cityPos[1], cityPos[2])
        const nx = cityPos[0] / clen
        const ny = cityPos[1] / clen
        const nz = cityPos[2] / clen
        let best = -1
        let bestDot = 0.25 // require decent elevation
        const start = stride > 1 ? Math.floor(Math.random() * stride) : 0
        for (let j = start; j < candN; j += stride) {
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
        bestSat[ci] = best
      }
      cursor.current = (cursor.current + RETARGET_PER_FRAME) % active
    }

    for (let ci = 0; ci < MAX_CITIES; ci++) {
      if (ci >= active) {
        // city not on the net yet
        linePos.fill(0, ci * 6, ci * 6 + 6)
        dummy.position.set(0, 0, 0)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        markerMesh.setMatrixAt(ci, dummy.matrix)
        for (let k = 0; k < PACKETS_PER_BEAM; k++) packetMesh.setMatrixAt(ci * PACKETS_PER_BEAM + k, dummy.matrix)
        continue
      }
      stationWorldPos(CITIES[ci], t, cityPos)
      const clen = Math.hypot(cityPos[0], cityPos[1], cityPos[2])

      // city marker
      dummy.position.set(cityPos[0] * 1.004, cityPos[1] * 1.004, cityPos[2] * 1.004)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      markerMesh.setMatrixAt(ci, dummy.matrix)

      // validate the cached satellite (fleet may have grown/shrunk under us;
      // the sat may have set below the horizon since its last re-pick)
      let best = earthLinks ? bestSat[ci] : -1
      if (best >= candN) best = bestSat[ci] = -1
      if (best >= 0) {
        const dx = posArr[best * 3] - cityPos[0]
        const dy = posArr[best * 3 + 1] - cityPos[1]
        const dz = posArr[best * 3 + 2] - cityPos[2]
        const dlen = Math.hypot(dx, dy, dz)
        const d = dlen > 1e-6 ? (cityPos[0] * dx + cityPos[1] * dy + cityPos[2] * dz) / (clen * dlen) : -1
        if (d < 0.1) best = bestSat[ci] = -1 // hysteresis below the 0.25 pick bar
      }

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
    }
    lineGeo.attributes.position.needsUpdate = true
    markerMesh.instanceMatrix.needsUpdate = true
    packetMesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {/* downlink beams — green, the color of data coming HOME */}
      <lineSegments geometry={lineGeo} frustumCulled={false}>
        <lineBasicMaterial color="#39ff8e" transparent opacity={0.38} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      {/* data packets streaming to ground */}
      <instancedMesh ref={packets} args={[undefined, undefined, MAX_CITIES * PACKETS_PER_BEAM]} frustumCulled={false}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshBasicMaterial color="#a9ffcd" toneMapped={false} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      {/* city markers */}
      <instancedMesh ref={markers} args={[undefined, undefined, MAX_CITIES]} frustumCulled={false}>
        <sphereGeometry args={[0.022, 10, 10]} />
        <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
      </instancedMesh>
      {labels && null /* city name labels are DOM-projected later if wanted */}
    </group>
  )
}
