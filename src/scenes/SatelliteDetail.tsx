import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { satConfigOf, satData, satIndexOf, setStatsFocus, simClock, useSimStore } from '../store/simStore'
import { CLASS_SPAN } from './SatelliteNet'
import { useFocusStore } from '../store/focusStore'
import { GROUND_STATIONS, stationWorldPos } from '../simulation/groundStations'
import { useSettingsStore } from '../store/settingsStore'
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
  const stats = useSimStore((s) => (satId ? s.focusedStats : null))

  // tell the sim loop which satellite needs live crosslink derivation
  useEffect(() => {
    setStatsFocus(satId)
    return () => setStatsFocus(null)
  }, [satId])

  const navLight = useRef<THREE.Mesh>(null)
  const linkGeos = useMemo(
    () => [new THREE.BufferGeometry(), new THREE.BufferGeometry(), new THREE.BufferGeometry()],
    [],
  )
  const linkPos = useMemo(() => [new Float32Array(6), new Float32Array(6), new Float32Array(6)], [])

  useFrame(({ clock }) => {
    if (!satId) return
    const i = satIndexOf(satId) * 3
    const posArr = satData.positions
    const sx = posArr[i]
    const sy = posArr[i + 1]
    const sz = posArr[i + 2]
    const S = useSettingsStore.getState().satScale

    const cfgForScale = satConfigOf(satId)
    const span = cfgForScale ? CLASS_SPAN[cfgForScale.cls] : 1
    if (navLight.current) {
      navLight.current.position.set(sx, sy + 0.14 * S * span, sz)
      navLight.current.scale.setScalar(Math.min(Math.max(S * span * 0.08, 0.012), 0.06))
      const on = Math.sin(clock.elapsedTime * 6) > 0.4
      ;(navLight.current.material as THREE.MeshBasicMaterial).opacity = on ? 1 : 0.08
    }

    const st = useSimStore.getState().focusedStats
    for (let k = 0; k < 2; k++) {
      const link = st?.crosslinks[k]
      const arr = linkPos[k]
      if (link) {
        const j = satIndexOf(link.to) * 3
        arr[0] = sx
        arr[1] = sy
        arr[2] = sz
        arr[3] = posArr[j]
        arr[4] = posArr[j + 1]
        arr[5] = posArr[j + 2]
      } else {
        arr.fill(0)
      }
      linkGeos[k].setAttribute('position', new THREE.BufferAttribute(arr, 3))
      linkGeos[k].attributes.position.needsUpdate = true
    }
    const cfg = satConfigOf(satId)
    const station = cfg ? GROUND_STATIONS.find((g) => g.id === cfg.groundStationId) : undefined
    const arr = linkPos[2]
    if (st?.groundVisible && station) {
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
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#ff5c6a" transparent toneMapped={false} />
      </mesh>
      {/* optical crosslinks — conceptual rendering of the laser mesh */}
      {[0, 1].map((k) => (
        <line key={k}>
          <primitive object={linkGeos[k]} attach="geometry" />
          <lineBasicMaterial color="#6fe3d2" transparent opacity={0.65} toneMapped={false} depthWrite={false} />
        </line>
      ))}
      {/* downlink beam to its home city */}
      <line>
        <primitive object={linkGeos[2]} attach="geometry" />
        <lineBasicMaterial color="#ffb454" transparent opacity={0.5} toneMapped={false} depthWrite={false} />
      </line>
    </group>
  )
}
