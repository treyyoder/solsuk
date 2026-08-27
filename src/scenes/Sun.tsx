import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SUN_VISUAL_RADIUS } from '../simulation/constants'
import { sunPosition } from '../simulation/orbits'
import { simClock } from '../store/simStore'
import { SUN_FRAG, SUN_VERT } from './shaders/sun'
import { webglCaps } from '../utils/webgl'
import { useFocusStore } from '../store/focusStore'
import { diagLog } from '../utils/diag'
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

/** Soft glowing tube texture for flare prominences — bright core fading to transparent at the edges. */
function flareTexture(): THREE.CanvasTexture {
  const w = 64
  const h = 16
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, 'rgba(255,140,40,0)')
  g.addColorStop(0.5, 'rgba(255,210,140,1)')
  g.addColorStop(1, 'rgba(255,140,40,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  return new THREE.CanvasTexture(canvas)
}

const scratch: Vec3 = [0, 0, 0]

const MAX_FLARES = 2
const FLARE_MIN_INTERVAL = 10
const FLARE_MAX_INTERVAL = 26
const FLARE_MIN_DURATION = 3.5
const FLARE_MAX_DURATION = 7

function randomPointOnSphere(r: number, out: THREE.Vector3) {
  const u = Math.random()
  const v = Math.random()
  const theta = 2 * Math.PI * u
  const phi = Math.acos(2 * v - 1)
  out.set(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi))
}

/** Prominence loop: two nearby points on the surface joined by an arc that
 * bows outward — the classic solar-flare silhouette (see reference imagery). */
function buildFlareCurve(radius: number): THREE.QuadraticBezierCurve3 {
  const a = new THREE.Vector3()
  randomPointOnSphere(radius, a)
  const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
  const angle = 0.35 + Math.random() * 0.55
  const b = a.clone().applyAxisAngle(axis, angle)
  const mid = a.clone().add(b).multiplyScalar(0.5)
  // reaches well past the corona glow (~1.3-2.4x visual radius) so it
  // reads as a distinct arc rather than blending into the ambient bloom
  const height = radius * (1.3 + Math.random() * 1.1)
  const control = mid.clone().normalize().multiplyScalar(a.length() * 0.3 + radius + height)
  return new THREE.QuadraticBezierCurve3(a, control, b)
}

interface FlareSlot {
  mesh: THREE.Mesh
  active: boolean
  startTime: number
  duration: number
}

/**
 * Occasional solar-flare prominences: a small pool of glowing arcs that spawn
 * at random real-time intervals, flare in over ~1s, hold, then fade — a
 * conceptual visualization of coronal mass ejections, not a physical model.
 */
function SolarFlares({ radius }: { radius: number }) {
  const flareMap = useMemo(() => flareTexture(), [])
  const flareTest = new URLSearchParams(window.location.search).has('flaretest')
  const nextSpawn = useRef(flareTest ? 0.5 : 2 + Math.random() * FLARE_MAX_INTERVAL)
  const slotsRef = useRef<FlareSlot[]>([])

  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    const slots = slotsRef.current

    if (now >= nextSpawn.current) {
      const free = slots.find((s) => !s.active)
      if (free) {
        const curve = buildFlareCurve(radius)
        const tube = new THREE.TubeGeometry(curve, 32, radius * 0.045, 8, false)
        free.mesh.geometry.dispose()
        free.mesh.geometry = tube
        free.active = true
        free.startTime = now
        free.duration = FLARE_MIN_DURATION + Math.random() * (FLARE_MAX_DURATION - FLARE_MIN_DURATION)
        free.mesh.visible = true
        diagLog(`flare spawned: slot visible=${free.mesh.visible} vertexCount=${tube.attributes.position.count} duration=${free.duration.toFixed(2)}`)
      }
      nextSpawn.current = now + (flareTest ? 1.5 : FLARE_MIN_INTERVAL + Math.random() * (FLARE_MAX_INTERVAL - FLARE_MIN_INTERVAL))
    }

    for (const slot of slots) {
      if (!slot.active) continue
      const p = (now - slot.startTime) / slot.duration
      if (p >= 1) {
        slot.active = false
        slot.mesh.visible = false
        continue
      }
      // fast flare-up, slow fade — sharper than a symmetric sine envelope
      const envelope = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85
      const mat = slot.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, envelope) * 0.95
    }
  })

  return (
    <group>
      {Array.from({ length: MAX_FLARES }).map((_, i) => (
        <mesh
          key={i}
          frustumCulled={false}
          ref={(m) => {
            // geometry and visibility are managed entirely imperatively
            // (mutated every frame / on each spawn) — no declarative
            // <bufferGeometry/> or visible= prop, so there's nothing for the
            // reconciler to reset the mutation back to on a re-render
            if (m && !slotsRef.current[i]) {
              m.geometry = new THREE.BufferGeometry()
              m.visible = false
              slotsRef.current[i] = { mesh: m, active: false, startTime: 0, duration: 1 }
            }
          }}
        >
          <meshBasicMaterial
            map={flareMap}
            color="#ff8a3c"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

/** The Sun: fbm-granulation shader sphere + additive corona sprites + occasional flares + the scene's key light. */
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
          if (e.delta > 6) return // drag-to-rotate release, not a click
          setFocus({ kind: 'sun' }, { fly: false })
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
        <SolarFlares radius={SUN_VISUAL_RADIUS} />
      </group>
    </>
  )
}
