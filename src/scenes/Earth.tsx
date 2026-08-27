import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { ATMOSPHERE_RADIUS, CLOUD_RADIUS, EARTH_RADIUS, EARTH_TILT } from '../simulation/constants'
import { earthRotation, sunDirection } from '../simulation/orbits'
import { simClock } from '../store/simStore'
import { EARTH_FRAG, EARTH_VERT } from './shaders/earth'
import { ATMO_FRAG, ATMO_VERT } from './shaders/atmosphere'
import { QUALITY_PRESETS, useSettingsStore } from '../store/settingsStore'
import { configureColorMap, textureUrl } from '../utils/textures'
import { useFocusStore } from '../store/focusStore'
import type { Vec3 } from '../simulation/types'

const sunScratch: Vec3 = [0, 0, 0]

export function Earth() {
  const quality = useSettingsStore((s) => s.quality)
  const preset = QUALITY_PRESETS[quality]
  const setFocus = useFocusStore((s) => s.setFocus)

  const [dayMap, nightMap, specMap, cloudMap] = useTexture([
    textureUrl('earth_day', true),
    textureUrl('earth_night', true),
    '/textures/earth_specular_2k.jpg',
    '/textures/earth_clouds_2k.jpg',
  ])
  configureColorMap(dayMap)
  configureColorMap(nightMap)

  const surfaceMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: EARTH_VERT,
        fragmentShader: EARTH_FRAG,
        uniforms: {
          uDayMap: { value: dayMap },
          uNightMap: { value: nightMap },
          uSpecMap: { value: specMap },
          uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        },
      }),
    [dayMap, nightMap, specMap],
  )

  const atmoMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        uniforms: {
          uSunDir: { value: new THREE.Vector3(1, 0, 0) },
          uColor: { value: new THREE.Color('#3b8dff') },
          uSurfaceR: { value: EARTH_RADIUS },
        },
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  const spinGroup = useRef<THREE.Group>(null)
  const cloudRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    sunDirection(simClock.t, sunScratch)
    ;(surfaceMat.uniforms.uSunDir.value as THREE.Vector3).set(...sunScratch)
    ;(atmoMat.uniforms.uSunDir.value as THREE.Vector3).set(...sunScratch)
    if (spinGroup.current) spinGroup.current.rotation.y = earthRotation(simClock.t)
    if (cloudRef.current) cloudRef.current.rotation.y = earthRotation(simClock.t) * 1.12
  })

  return (
    <group rotation={[0, 0, EARTH_TILT]}>
      <group ref={spinGroup}>
        <mesh
          material={surfaceMat}
          onClick={(e) => {
            e.stopPropagation()
            if (e.delta > 6) return // drag-to-rotate release, not a click
            setFocus({ kind: 'earth' }, { fly: false })
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'default')}
        >
          <sphereGeometry args={[EARTH_RADIUS, preset.earthSegments, preset.earthSegments]} />
        </mesh>
      </group>
      {preset.clouds && (
        <mesh ref={cloudRef} raycast={() => null}>
          <sphereGeometry args={[CLOUD_RADIUS, Math.min(preset.earthSegments, 96), Math.min(preset.earthSegments, 96)]} />
          <meshLambertMaterial map={cloudMap} transparent opacity={0.85} alphaMap={cloudMap} depthWrite={false} />
        </mesh>
      )}
      <mesh material={atmoMat} raycast={() => null}>
        <sphereGeometry args={[ATMOSPHERE_RADIUS, 48, 48]} />
      </mesh>
    </group>
  )
}
