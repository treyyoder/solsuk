import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FLEET, satIndexOf, satPositions, simClock, useSimStore } from '../store/simStore'
import { useFocusStore } from '../store/focusStore'
import { GROUND_STATIONS, stationWorldPos } from '../simulation/groundStations'
import type { Vec3 } from '../simulation/types'

const gsScratch: Vec3 = [0, 0, 0]

/**
 * Extras rendered only for the focused satellite: blinking nav light,
 * optical crosslink lasers to its two partners, and the ground-station
 * downlink beam when the station is in view.
 */
export function SatelliteDetail() {
  const focus = useFocusStore((s) => s.focus)
  const satId = focus.kind === 'satellite' ? focus.id : null
  const stats = useSimStore((s) => (satId ? s.stats[satId] : null))

  const navLight = useRef<THREE.Mesh>(null)
  const linkGeos = useMemo(
    () => [new THREE.BufferGeometry(), new THREE.BufferGeometry(), new THREE.BufferGeometry()],
    [],
  )
  const linkPos = useMemo(() => [new Float32Array(6), new Float32Array(6), new Float32Array(6)], [])

  useFrame(({ clock }) => {
    if (!satId) return
    const i = satIndexOf(satId) * 3
    const sx = satPositions[i]
    const sy = satPositions[i + 1]
    const sz = satPositions[i + 2]

    if (navLight.current) {
      navLight.current.position.set(sx, sy + 0.09, sz)
      const on = Math.sin(clock.elapsedTime * 6) > 0.4
      ;(navLight.current.material as THREE.MeshBasicMaterial).opacity = on ? 1 : 0.08
    }

    const st = useSimStore.getState().stats[satId]
    // crosslinks
    for (let k = 0; k < 2; k++) {
      const link = st?.crosslinks[k]
      const arr = linkPos[k]
      if (link) {
        const j = satIndexOf(link.to) * 3
        arr[0] = sx
        arr[1] = sy
        arr[2] = sz
        arr[3] = satPositions[j]
        arr[4] = satPositions[j + 1]
        arr[5] = satPositions[j + 2]
      } else {
        arr.fill(0)
      }
      linkGeos[k].setAttribute('position', new THREE.BufferAttribute(arr, 3))
      linkGeos[k].attributes.position.needsUpdate = true
    }
    // ground beam
    const cfg = FLEET[satIndexOf(satId)]
    const station = GROUND_STATIONS.find((g) => g.id === cfg.groundStationId)!
    const arr = linkPos[2]
    if (st?.groundVisible) {
      stationWorldPos(station, simClock.t, gsScratch)
      arr[0] = sx
      arr[1] = sy
      arr[2] = sz
      arr[3] = gsScratch[0]
      arr[4] = gsScratch[1]
      arr[5] = gsScratch[2]
    } else {
      arr.fill(0)
    }
    linkGeos[2].setAttribute('position', new THREE.BufferAttribute(arr, 3))
    linkGeos[2].attributes.position.needsUpdate = true
  })

  if (!satId || !stats) return null

  return (
    <group>
      <mesh ref={navLight}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshBasicMaterial color="#ff5c6a" transparent toneMapped={false} />
      </mesh>
      {/* optical crosslinks — conceptual rendering of the laser mesh */}
      {[0, 1].map((k) => (
        <line key={k}>
          <primitive object={linkGeos[k]} attach="geometry" />
          <lineBasicMaterial color="#6fe3d2" transparent opacity={0.65} toneMapped={false} depthWrite={false} />
        </line>
      ))}
      {/* downlink beam */}
      <line>
        <primitive object={linkGeos[2]} attach="geometry" />
        <lineBasicMaterial color="#ffb454" transparent opacity={0.5} toneMapped={false} depthWrite={false} />
      </line>
    </group>
  )
}
