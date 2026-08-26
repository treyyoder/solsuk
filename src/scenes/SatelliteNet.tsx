import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { computeSatBasis, satPositionAndTangent, satPositionAtTheta, sunDirection } from '../simulation/orbits'
import { getFleet, getFleetByClass, satData, satIndexOf, simClock, useSimStore } from '../store/simStore'
import { CLASS_CAPACITY, FACILITY_CLASSES, type FacilityClass } from '../simulation/epochModel'
import { useFocusStore } from '../store/focusStore'
import { useSettingsStore } from '../store/settingsStore'
import type { Vec3 } from '../simulation/types'

/**
 * Six visibly distinct facility generations, each a single merged geometry
 * (multi-material via groups) rendered as ONE InstancedMesh — one matrix per
 * facility per frame, which is what keeps ~30k facilities in 2084 rendable.
 * Dimensions are per-class absolute (a Gigawatt Complex spans ~80× a Pioneer),
 * with the SIZE slider as a global multiplier.
 */

interface Part {
  mat: 'mli' | 'panel' | 'radiator'
  dims: [number, number, number]
  pos: [number, number, number]
}

const box = (mat: Part['mat'], dims: Part['dims'], pos: Part['pos']): Part => ({ mat, dims, pos })

/** X = wing/spine axis, Y = anti-nadir, Z = cross-track */
const CLASS_PARTS: Record<FacilityClass, Part[]> = {
  pioneer: [
    box('mli', [0.11, 0.1, 0.1], [0, 0, 0]),
    box('panel', [0.55, 0.008, 0.16], [0.37, 0, 0]),
    box('panel', [0.55, 0.008, 0.16], [-0.37, 0, 0]),
    box('radiator', [0.09, 0.006, 0.12], [0, 0.055, 0]),
  ],
  cluster: [
    box('mli', [0.16, 0.13, 0.13], [0, 0, 0]),
    box('panel', [0.9, 0.01, 0.24], [0.62, 0, 0]),
    box('panel', [0.9, 0.01, 0.24], [-0.62, 0, 0]),
    box('radiator', [0.3, 0.008, 0.16], [0, 0.08, 0]),
    box('radiator', [0.3, 0.008, 0.16], [0, -0.08, 0]),
  ],
  edge: [
    box('mli', [0.75, 0.05, 0.05], [0, 0, 0]),
    box('mli', [0.16, 0.14, 0.14], [0.2, 0, 0]),
    box('mli', [0.16, 0.14, 0.14], [-0.2, 0, 0]),
    box('panel', [1.2, 0.01, 0.3], [1.05, 0, 0]),
    box('panel', [1.2, 0.01, 0.3], [-1.05, 0, 0]),
    box('radiator', [0.5, 0.3, 0.01], [0, 0.05, 0.3]),
    box('radiator', [0.5, 0.3, 0.01], [0, 0.05, -0.3]),
  ],
  standard: [
    box('mli', [1.4, 0.07, 0.07], [0, 0, 0]),
    box('mli', [0.22, 0.19, 0.19], [-0.4, 0, 0]),
    box('mli', [0.22, 0.19, 0.19], [0, 0, 0]),
    box('mli', [0.22, 0.19, 0.19], [0.4, 0, 0]),
    box('panel', [1.9, 0.012, 0.44], [1.75, 0, 0]),
    box('panel', [1.9, 0.012, 0.44], [-1.75, 0, 0]),
    box('radiator', [0.95, 0.5, 0.012], [0, 0.1, 0.45]),
    box('radiator', [0.95, 0.5, 0.012], [0, 0.1, -0.45]),
  ],
  hyper: [
    box('mli', [2.4, 0.1, 0.1], [0, 0, 0]),
    box('mli', [0.28, 0.24, 0.24], [-0.9, 0, 0]),
    box('mli', [0.28, 0.24, 0.24], [-0.45, 0, 0]),
    box('mli', [0.28, 0.24, 0.24], [0, 0, 0]),
    box('mli', [0.28, 0.24, 0.24], [0.45, 0, 0]),
    box('mli', [0.28, 0.24, 0.24], [0.9, 0, 0]),
    box('panel', [2.8, 0.014, 0.55], [2.7, 0, 0.34]),
    box('panel', [2.8, 0.014, 0.55], [2.7, 0, -0.34]),
    box('panel', [2.8, 0.014, 0.55], [-2.7, 0, 0.34]),
    box('panel', [2.8, 0.014, 0.55], [-2.7, 0, -0.34]),
    box('radiator', [1.5, 0.75, 0.016], [0.65, 0.12, 0.7]),
    box('radiator', [1.5, 0.75, 0.016], [-0.65, 0.12, 0.7]),
    box('radiator', [1.5, 0.75, 0.016], [0.65, 0.12, -0.7]),
    box('radiator', [1.5, 0.75, 0.016], [-0.65, 0.12, -0.7]),
  ],
  giga: [
    box('mli', [4.4, 0.15, 0.15], [0, 0, 0]),
    box('mli', [0.38, 0.32, 0.32], [-1.8, 0, 0]),
    box('mli', [0.38, 0.32, 0.32], [-1.08, 0, 0]),
    box('mli', [0.38, 0.32, 0.32], [-0.36, 0, 0]),
    box('mli', [0.38, 0.32, 0.32], [0.36, 0, 0]),
    box('mli', [0.38, 0.32, 0.32], [1.08, 0, 0]),
    box('mli', [0.38, 0.32, 0.32], [1.8, 0, 0]),
    box('panel', [4.4, 0.018, 1.0], [4.5, 0, 0.6]),
    box('panel', [4.4, 0.018, 1.0], [4.5, 0, -0.6]),
    box('panel', [4.4, 0.018, 1.0], [-4.5, 0, 0.6]),
    box('panel', [4.4, 0.018, 1.0], [-4.5, 0, -0.6]),
    box('radiator', [2.4, 1.1, 0.02], [-1.3, 0.18, 1.2]),
    box('radiator', [2.4, 1.1, 0.02], [0, 0.18, 1.2]),
    box('radiator', [2.4, 1.1, 0.02], [1.3, 0.18, 1.2]),
    box('radiator', [2.4, 1.1, 0.02], [-1.3, 0.18, -1.2]),
    box('radiator', [2.4, 1.1, 0.02], [0, 0.18, -1.2]),
    box('radiator', [2.4, 1.1, 0.02], [1.3, 0.18, -1.2]),
  ],
}

/** half-span (largest |x| or |z| extent) per class — used for chase-camera framing */
export const CLASS_SPAN: Record<FacilityClass, number> = {
  pioneer: 0.65, cluster: 1.1, edge: 1.7, standard: 2.7, hyper: 4.1, giga: 6.7,
}

// ---------------------------------------------------------------- textures

function panelTexture(): THREE.CanvasTexture {
  const w = 512
  const h = 168
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0a1830'
  ctx.fillRect(0, 0, w, h)
  const segs = 3
  const segGap = 10
  const segW = (w - segGap * (segs - 1)) / segs
  const cols = 10
  const rows = 6
  for (let s = 0; s < segs; s++) {
    const x0 = s * (segW + segGap)
    const cellW = segW / cols
    const cellH = h / rows
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const shade = 0.75 + ((cx * 7 + cy * 13 + s * 5) % 10) * 0.035
        ctx.fillStyle = `rgb(${Math.round(16 * shade)}, ${Math.round(38 * shade)}, ${Math.round(84 * shade)})`
        ctx.fillRect(x0 + cx * cellW + 1, cy * cellH + 1, cellW - 2, cellH - 2)
        ctx.fillStyle = 'rgba(140, 180, 240, 0.18)'
        ctx.fillRect(x0 + cx * cellW + 1, cy * cellH + 1, cellW - 2, 2)
      }
    }
    ctx.strokeStyle = 'rgba(190, 205, 225, 0.55)'
    ctx.lineWidth = 1
    for (let cx = 0; cx <= cols; cx++) {
      ctx.beginPath()
      ctx.moveTo(x0 + cx * cellW, 0)
      ctx.lineTo(x0 + cx * cellW, h)
      ctx.stroke()
    }
    for (let cy = 0; cy <= rows; cy++) {
      ctx.beginPath()
      ctx.moveTo(x0, cy * cellH)
      ctx.lineTo(x0 + segW, cy * cellH)
      ctx.stroke()
    }
  }
  ctx.fillStyle = '#454f5e'
  for (let s = 1; s < segs; s++) ctx.fillRect(s * (segW + segGap) - segGap, 0, segGap, h)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

function foilTexture(): THREE.CanvasTexture {
  const s = 128
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#8a6a2c'
  ctx.fillRect(0, 0, s, s)
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * s
    const y = Math.random() * s
    const w = 4 + Math.random() * 14
    const h = 3 + Math.random() * 9
    const lum = 0.72 + Math.random() * 0.65
    ctx.fillStyle = `rgb(${Math.round(148 * lum)}, ${Math.round(110 * lum)}, ${Math.round(46 * lum)})`
    ctx.fillRect(x, y, w, h)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ---------------------------------------------------------------- scratch

const pos: Vec3 = [0, 0, 0]
const tangent: Vec3 = [0, 0, 0]
const sunScratch: Vec3 = [0, 0, 0]
const vX = new THREE.Vector3()
const vY = new THREE.Vector3()
const vZ = new THREE.Vector3()
const vSun = new THREE.Vector3()
const vPos = new THREE.Vector3()
const mBasis = new THREE.Matrix4()
const mLocal = new THREE.Matrix4()
const mOut = new THREE.Matrix4()
const qRoll = new THREE.Quaternion()
const vScale = new THREE.Vector3(1, 1, 1)
const V_TMP = new THREE.Vector3()
const AXIS_X = new THREE.Vector3(1, 0, 0)
const IDENTITY_Q = new THREE.Quaternion()

const COLOR_DEFAULT = new THREE.Color('#ffffff')
const COLOR_SELECTED = new THREE.Color('#ffd9a0')

const TOTAL_CAPACITY = FACILITY_CLASSES.reduce((n, c) => n + CLASS_CAPACITY[c], 0)

export function SatelliteNet() {
  const classMeshes = useRef<Partial<Record<FacilityClass, THREE.InstancedMesh>>>({})
  const picks = useRef<THREE.InstancedMesh>(null)
  const dots = useRef<THREE.Points>(null)

  const setFocus = useFocusStore((s) => s.setFocus)
  const setHoveredSat = useFocusStore((s) => s.setHoveredSat)
  const showOrbits = useSettingsStore((s) => s.orbits)
  const fleetVersion = useSimStore((s) => s.fleetVersion)
  const focus = useFocusStore((s) => s.focus)

  const cellTex = useMemo(() => panelTexture(), [])
  const mliTex = useMemo(() => foilTexture(), [])

  const materials = useMemo(
    () => ({
      mli: new THREE.MeshStandardMaterial({ map: mliTex, color: '#c9a86a', metalness: 0.75, roughness: 0.45 }),
      panel: new THREE.MeshStandardMaterial({
        map: cellTex,
        metalness: 0.45,
        roughness: 0.3,
        emissive: '#12305e',
        emissiveIntensity: 0.22,
        emissiveMap: cellTex,
      }),
      radiator: new THREE.MeshStandardMaterial({
        color: '#eef2f7',
        metalness: 0.2,
        roughness: 0.4,
        emissive: '#ff9a66',
        emissiveIntensity: 0.05,
      }),
    }),
    [cellTex, mliTex],
  )

  /** merged multi-material geometry per class: one bucket-merge per material, then group-merge */
  const classGeometry = useMemo(() => {
    const out = {} as Record<FacilityClass, { geometry: THREE.BufferGeometry; materials: THREE.Material[] }>
    const MAT_ORDER: Part['mat'][] = ['mli', 'panel', 'radiator']
    for (const cls of FACILITY_CLASSES) {
      const buckets: Record<Part['mat'], THREE.BufferGeometry[]> = { mli: [], panel: [], radiator: [] }
      for (const part of CLASS_PARTS[cls]) {
        const g = new THREE.BoxGeometry(...part.dims)
        g.translate(...part.pos)
        buckets[part.mat].push(g)
      }
      const merged: THREE.BufferGeometry[] = []
      const mats: THREE.Material[] = []
      for (const m of MAT_ORDER) {
        if (!buckets[m].length) continue
        merged.push(mergeGeometries(buckets[m], false)!)
        mats.push(materials[m])
      }
      out[cls] = { geometry: mergeGeometries(merged, true)!, materials: mats }
    }
    return out
  }, [materials])

  // selection tint via per-instance colors — reapplied on fleet/focus changes
  useEffect(() => {
    const f = useFocusStore.getState().focus
    const selectedId = f.kind === 'satellite' ? f.id : null
    const byClass = getFleetByClass()
    for (const cls of FACILITY_CLASSES) {
      const mesh = classMeshes.current[cls]
      if (!mesh) continue
      const arr = byClass[cls]
      for (let k = 0; k < arr.length; k++) {
        mesh.setColorAt(k, arr[k].id === selectedId ? COLOR_SELECTED : COLOR_DEFAULT)
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }, [fleetVersion, focus])

  useFrame(() => {
    const pickMesh = picks.current
    if (!pickMesh) return
    const t = simClock.t
    const fleet = getFleet()
    const byClass = getFleetByClass()
    const S = useSettingsStore.getState().satScale
    sunDirection(t, sunScratch)
    vSun.set(sunScratch[0], sunScratch[1], sunScratch[2])

    let globalIdx = 0
    for (const cls of FACILITY_CLASSES) {
      const mesh = classMeshes.current[cls]
      const arr = byClass[cls]
      if (mesh) mesh.count = arr.length
      for (let k = 0; k < arr.length; k++, globalIdx++) {
        const cfg = arr[k]
        satPositionAndTangent(cfg, t, sunScratch, pos, tangent)
        satData.positions[globalIdx * 3] = pos[0]
        satData.positions[globalIdx * 3 + 1] = pos[1]
        satData.positions[globalIdx * 3 + 2] = pos[2]

        vPos.set(pos[0], pos[1], pos[2])
        // nadir frame: Y radial-out, X along-track (wing axis), Z completes
        vY.copy(vPos).normalize()
        vX.set(tangent[0], tangent[1], tangent[2])
        vZ.crossVectors(vX, vY).normalize()
        vX.crossVectors(vY, vZ).normalize()
        mBasis.makeBasis(vX, vY, vZ).setPosition(vPos)

        // sun-tracking roll of the whole body about the wing axis
        const sy = vSun.dot(vY)
        const sz = vSun.dot(vZ)
        qRoll.setFromAxisAngle(AXIS_X, Math.atan2(sz, sy))

        if (mesh) {
          mLocal.compose(V_TMP.set(0, 0, 0), qRoll, vScale.setScalar(S))
          mOut.multiplyMatrices(mBasis, mLocal)
          mesh.setMatrixAt(k, mOut)
        }

        // pick target sized to the facility
        const pickR = Math.min(Math.max(S * CLASS_SPAN[cls] * 0.9, 0.05), 1.2)
        mLocal.compose(V_TMP.set(0, 0, 0), IDENTITY_Q, vScale.setScalar(pickR / 0.1))
        mOut.multiplyMatrices(mBasis, mLocal)
        pickMesh.setMatrixAt(globalIdx, mOut)
      }
      if (mesh) mesh.instanceMatrix.needsUpdate = true
    }
    pickMesh.count = fleet.length
    pickMesh.instanceMatrix.needsUpdate = true

    if (dots.current) {
      const attr = dots.current.geometry.attributes.position as THREE.BufferAttribute | undefined
      if (attr) {
        attr.needsUpdate = true
        dots.current.geometry.setDrawRange(0, fleet.length)
      }
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.instanceId === undefined) return
    const cfg = getFleet()[e.instanceId]
    if (cfg) setFocus({ kind: 'satellite', id: cfg.id })
  }

  /** focused facility's full orbit ring (its personal pattern) */
  const focusRing = useMemo(() => {
    if (focus.kind !== 'satellite') return null
    const cfg = getFleet()[satIndexOf(focus.id)]
    if (!cfg || cfg.id !== focus.id) return null
    const sd: Vec3 = [0, 0, 0]
    sunDirection(simClock.t, sd)
    computeSatBasis(cfg, sd)
    const pts: [number, number, number][] = []
    for (let k = 0; k <= 128; k++) {
      const theta = cfg.phase + (k / 128) * Math.PI * 2
      const p: Vec3 = [0, 0, 0]
      satPositionAtTheta(cfg, theta, p)
      pts.push([p[0], p[1], p[2]])
    }
    return pts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, fleetVersion])

  // glint layer buffer — replaced whenever the positions array identity changes
  const glintGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(satData.positions, 3))
    geo.setDrawRange(0, getFleet().length)
    return geo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fleetVersion])

  return (
    <group>
      {/* net-glint layer: one additive point per facility so the whole
          constellation reads from any distance even at tiny hardware scale */}
      <points ref={dots} geometry={glintGeometry} frustumCulled={false}>
        <pointsMaterial
          size={2.4}
          sizeAttenuation={false}
          color="#bcd8ff"
          transparent
          opacity={0.8}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* invisible generous pick targets (one shared mesh, global fleet order) */}
      <instancedMesh
        ref={picks}
        args={[undefined, undefined, TOTAL_CAPACITY]}
        frustumCulled={false}
        visible={false}
        onClick={handleClick}
        onPointerMove={(e) => {
          e.stopPropagation()
          if (e.instanceId !== undefined) {
            const cfg = getFleet()[e.instanceId]
            if (cfg) {
              setHoveredSat(cfg.id)
              document.body.style.cursor = 'pointer'
            }
          }
        }}
        onPointerOut={() => {
          setHoveredSat(null)
          document.body.style.cursor = 'default'
        }}
      >
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial />
      </instancedMesh>

      {/* one instanced mesh per facility generation */}
      {FACILITY_CLASSES.map((cls) => (
        <instancedMesh
          key={cls}
          args={[classGeometry[cls].geometry, classGeometry[cls].materials as unknown as THREE.Material, CLASS_CAPACITY[cls]]}
          frustumCulled={false}
          raycast={() => null}
          ref={(m) => {
            classMeshes.current[cls] = m ?? undefined
          }}
        />
      ))}

      {/* focused facility's own orbital pattern */}
      {showOrbits && focusRing && (
        <Line points={focusRing} color="#2c4a6e" transparent opacity={0.35} lineWidth={1} />
      )}
    </group>
  )
}
