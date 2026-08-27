import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { MOON_RADIUS } from '../simulation/constants'
import { latLonToVec, moonPosition } from '../simulation/orbits'
import { MOON_BASES } from '../simulation/moonBases'
import { simClock } from '../store/simStore'
import { useFocusStore } from '../store/focusStore'
import { configureColorMap, textureUrl } from '../utils/textures'
import type { Vec3 } from '../simulation/types'

const posScratch: Vec3 = [0, 0, 0]
const baseScratch: Vec3 = [0, 0, 0]

/** live world position of the moon group, readable by the camera rig */
export const moonWorldPos = new THREE.Vector3(40, 0, 0)

function BaseMarker({ baseId, latDeg, lonDeg }: { baseId: string; latDeg: number; lonDeg: number }) {
  const setFocus = useFocusStore((s) => s.setFocus)
  const focus = useFocusStore((s) => s.focus)
  const ringRef = useRef<THREE.Mesh>(null)
  const selected = focus.kind === 'moon' && focus.baseId === baseId

  latLonToVec(latDeg, lonDeg, MOON_RADIUS, baseScratch)
  const pos: [number, number, number] = [baseScratch[0], baseScratch[1], baseScratch[2]]
  const normal = new THREE.Vector3(...pos).normalize()
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 2.4) * 0.25
      ringRef.current.scale.setScalar(selected ? s * 1.6 : s)
      ;(ringRef.current.material as THREE.MeshBasicMaterial).opacity = selected ? 0.95 : 0.55
    }
  })

  return (
    <group
      position={pos}
      quaternion={quat}
      onClick={(e) => {
        e.stopPropagation()
        if (e.delta > 6) return // drag-to-rotate release, not a click
        setFocus({ kind: 'moon', baseId })
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => (document.body.style.cursor = 'default')}
    >
      {/* habitat dome */}
      <mesh>
        <sphereGeometry args={[0.022, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#cfd8e6" emissive="#6fe3d2" emissiveIntensity={0.9} roughness={0.4} />
      </mesh>
      {/* antenna mast */}
      <mesh position={[0, 0.035, 0]}>
        <cylinderGeometry args={[0.0015, 0.0015, 0.05, 6]} />
        <meshBasicMaterial color="#9fb6cc" />
      </mesh>
      {/* pulsing locator ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[0.035, 0.042, 32]} />
        <meshBasicMaterial color="#6fe3d2" transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* generous invisible pick target */}
      <mesh visible={false}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  )
}

export function Moon() {
  const group = useRef<THREE.Group>(null)
  const setFocus = useFocusStore((s) => s.setFocus)
  const [colorMap] = useTexture([textureUrl('moon', true)])
  configureColorMap(colorMap)

  useFrame(() => {
    const g = group.current
    if (!g) return
    moonPosition(simClock.t, posScratch)
    g.position.set(posScratch[0], posScratch[1], posScratch[2])
    moonWorldPos.set(posScratch[0], posScratch[1], posScratch[2])
    // tidal lock: keep one face toward Earth (origin)
    g.rotation.y = Math.atan2(posScratch[0], posScratch[2]) + Math.PI
  })

  return (
    <group ref={group}>
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          if (e.delta > 6) return // drag-to-rotate release, not a click
          setFocus({ kind: 'moon' }, { fly: false })
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'default')}
      >
        <sphereGeometry args={[MOON_RADIUS, 64, 64]} />
        <meshStandardMaterial map={colorMap} roughness={0.95} metalness={0} />
      </mesh>
      {MOON_BASES.map((b) => (
        <BaseMarker key={b.id} baseId={b.id} latDeg={b.latDeg} lonDeg={b.lonDeg} />
      ))}
    </group>
  )
}
