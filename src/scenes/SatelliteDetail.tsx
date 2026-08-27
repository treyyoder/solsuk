import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MAX_CROSSLINKS, satConfigOf, satData, satIndexOf, setStatsFocus, simClock, useSimStore } from '../store/simStore'
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
  // one segment per crosslink peer (up to MAX_CROSSLINKS) + one ground beam
  const crossGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_CROSSLINKS * 6), 3))
    geo.setDrawRange(0, 0)
    return geo
  }, [])
  const groundGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    return geo
  }, [])

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
    const cross = crossGeo.attributes.position.array as Float32Array
    const links = st?.crosslinks ?? []
    const count = Math.min(links.length, MAX_CROSSLINKS)
    for (let k = 0; k < count; k++) {
      const j = satIndexOf(links[k].to) * 3
      cross[k * 6] = sx
      cross[k * 6 + 1] = sy
      cross[k * 6 + 2] = sz
      cross[k * 6 + 3] = posArr[j]
      cross[k * 6 + 4] = posArr[j + 1]
      cross[k * 6 + 5] = posArr[j + 2]
    }
    crossGeo.setDrawRange(0, count * 2)
    crossGeo.attributes.position.needsUpdate = true

    const cfg = satConfigOf(satId)
    const station = cfg ? GROUND_STATIONS.find((g) => g.id === cfg.groundStationId) : undefined
    const arr = groundGeo.attributes.position.array as Float32Array
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
    groundGeo.attributes.position.needsUpdate = true
  })

  if (!satId || !stats) return null

  return (
    <group>
      <mesh ref={navLight}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#ff5c6a" transparent toneMapped={false} />
      </mesh>
      {/* optical crosslinks to the K closest peers — purple, the cooperation color */}
      <lineSegments geometry={crossGeo} frustumCulled={false}>
        <lineBasicMaterial color="#b44cff" transparent opacity={0.7} toneMapped={false} depthWrite={false} />
      </lineSegments>
      {/* downlink beam to its home city — green, data heading home */}
      <line>
        <primitive object={groundGeo} attach="geometry" />
        <lineBasicMaterial color="#39ff8e" transparent opacity={0.55} toneMapped={false} depthWrite={false} />
      </line>
    </group>
  )
}
