import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SUN_VISUAL_RADIUS } from '../simulation/constants'
import { sunPosition } from '../simulation/orbits'
import { simClock } from '../store/simStore'
import { SUN_FRAG, SUN_VERT } from './shaders/sun'
import { webglCaps } from '../utils/webgl'
import { useFocusStore } from '../store/focusStore'
import type { Vec3 } from '../simulation/types'

function coronaTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255, 244, 214, 1)')
  g.addColorStop(0.18, 'rgba(255, 214, 140, 0.55)')
  g.addColorStop(0.45, 'rgba(255, 170, 80, 0.16)')
  g.addColorStop(1, 'rgba(255, 140, 40, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

const scratch: Vec3 = [0, 0, 0]

/** The Sun: fbm-granulation shader sphere + additive corona sprites + the scene's key light. */
export function Sun() {
  const group = useRef<THREE.Group>(null)
  const mat = useRef<THREE.ShaderMaterial>(null)
  const light = useRef<THREE.DirectionalLight>(null)
  const setFocus = useFocusStore((s) => s.setFocus)

  const bloomless = !webglCaps().floatRT
  const coronaMap = useMemo(() => coronaTexture(), [])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SUN_VERT,
        fragmentShader: SUN_FRAG,
        uniforms: {
          uTime: { value: 0 },
          // without bloom the shader carries all the "burn" itself
          uBoost: { value: bloomless ? 1.9 : 2.6 },
        },
        toneMapped: false,
      } as THREE.ShaderMaterialParameters),
    [bloomless],
  )

  useFrame((_, delta) => {
    if (mat.current) mat.current.uniforms.uTime.value += delta
    const g = group.current
    if (!g) return
    sunPosition(simClock.t, scratch)
    g.position.set(scratch[0], scratch[1], scratch[2])
    if (light.current) {
      // key light shines from the sun toward the origin
      light.current.position.set(scratch[0], scratch[1], scratch[2])
    }
  })

  const coronaScales = bloomless ? [26, 48, 92] : [24, 44]

  return (
    <>
      <directionalLight ref={light} intensity={3.1} color="#fff4dc" />
      <ambientLight intensity={0.055} color="#7788aa" />
      <group
        ref={group}
        onClick={(e) => {
          e.stopPropagation()
          setFocus({ kind: 'sun' })
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'default')}
      >
        <mesh
          material={material}
          ref={(m) => void (mat.current = m ? (m.material as THREE.ShaderMaterial) : null)}
        >
          <sphereGeometry args={[SUN_VISUAL_RADIUS, 48, 48]} />
        </mesh>
        {coronaScales.map((s, i) => (
          <sprite key={i} scale={[s, s, 1]}>
            <spriteMaterial
              map={coronaMap}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              opacity={0.85 - i * 0.22}
              toneMapped={false}
            />
          </sprite>
        ))}
      </group>
    </>
  )
}
