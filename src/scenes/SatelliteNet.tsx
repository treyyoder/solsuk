import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { satPosition, sunDirection } from '../simulation/orbits'
import { getFleet, satData, satIndexOf, simClock, useSimStore } from '../store/simStore'
import { useFocusStore } from '../store/focusStore'
import { useSettingsStore } from '../store/settingsStore'
import type { Vec3 } from '../simulation/types'

/**
 * Data-center hardware at unit scale (satScale=1): a boxy MLI-wrapped bus with
 * a white radiator, and two LARGE three-segment solar wings with visible cell
 * grids — modeled on real comsat proportions, wings dwarfing the bus.
 */
const BUS = { x: 0.11, y: 0.1, z: 0.1 }
const RADIATOR = { x: 0.09, y: 0.006, z: 0.12 }
const WING = { len: 0.55, width: 0.16, thick: 0.008 }
const WING_GAP = 0.02 // strut length between bus and wing root

// scratch objects — zero per-frame allocation
const pos: Vec3 = [0, 0, 0]
const posAhead: Vec3 = [0, 0, 0]
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
const qTip = new THREE.Quaternion()
const vScale = new THREE.Vector3(1, 1, 1)
const V_TMP = new THREE.Vector3()
const AXIS_X = new THREE.Vector3(1, 0, 0)
const AXIS_Z = new THREE.Vector3(0, 0, 1)

const COLOR_SUNLIT = new THREE.Color('#ffffff')
const COLOR_ECLIPSE = new THREE.Color('#41506b')
const COLOR_SELECTED = new THREE.Color('#ffd9a0')

/** Photovoltaic cell-grid texture: dark blue cells, thin silver busbars, three wing segments. */
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
        // cell glint corner
        ctx.fillStyle = 'rgba(140, 180, 240, 0.18)'
        ctx.fillRect(x0 + cx * cellW + 1, cy * cellH + 1, cellW - 2, 2)
      }
    }
    // silver busbar grid lines
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
  // segment hinges
  ctx.fillStyle = '#454f5e'
  for (let s = 1; s < segs; s++) {
    ctx.fillRect(s * (segW + segGap) - segGap, 0, segGap, h)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** Gold MLI foil for the bus. */
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

export function SatelliteNet() {
  const buses = useRef<THREE.InstancedMesh>(null)
  const radiators = useRef<THREE.InstancedMesh>(null)
  const wings = useRef<THREE.InstancedMesh>(null)
  const struts = useRef<THREE.InstancedMesh>(null)
  const picks = useRef<THREE.InstancedMesh>(null)
  const dots = useRef<THREE.Points>(null)

  const setFocus = useFocusStore((s) => s.setFocus)
  const setHoveredSat = useFocusStore((s) => s.setHoveredSat)
  const showOrbits = useSettingsStore((s) => s.orbits)
  const fleetVersion = useSimStore((s) => s.fleetVersion)
  const satCount = useSimStore((s) => s.satCount)
  const focus = useFocusStore((s) => s.focus)

  const cellTex = useMemo(() => panelTexture(), [])
  const mliTex = useMemo(() => foilTexture(), [])

  // selection highlight via instance colors (fleet is always-sunlit by design,
  // but the eclipse tint stays for satellites the user drags off-pattern later)
  useEffect(() => {
    const apply = () => {
      const wingMesh = wings.current
      const busMesh = buses.current
      if (!wingMesh || !busMesh) return
      const fleet = getFleet()
      const f = useFocusStore.getState().focus
      const selectedId = f.kind === 'satellite' ? f.id : null
      const stats = useSimStore.getState().stats
      for (let i = 0; i < fleet.length; i++) {
        const st = stats[fleet[i].id]
        const c = fleet[i].id === selectedId ? COLOR_SELECTED : st && st.eclipsed ? COLOR_ECLIPSE : COLOR_SUNLIT
        wingMesh.setColorAt(i * 2, c)
        wingMesh.setColorAt(i * 2 + 1, c)
        busMesh.setColorAt(i, c)
      }
      if (wingMesh.instanceColor) wingMesh.instanceColor.needsUpdate = true
      if (busMesh.instanceColor) busMesh.instanceColor.needsUpdate = true
    }
    apply()
    return useSimStore.subscribe(apply)
  }, [fleetVersion, focus])

  useFrame(() => {
    const busMesh = buses.current
    const radMesh = radiators.current
    const wingMesh = wings.current
    const strutMesh = struts.current
    const pickMesh = picks.current
    if (!busMesh || !radMesh || !wingMesh || !strutMesh || !pickMesh) return

    const t = simClock.t
    const fleet = getFleet()
    const S = useSettingsStore.getState().satScale
    const pickR = Math.min(Math.max(S * 1.4, 0.05), 0.25)
    sunDirection(t, sunScratch)
    vSun.set(sunScratch[0], sunScratch[1], sunScratch[2])

    for (let i = 0; i < fleet.length; i++) {
      const cfg = fleet[i]
      satPosition(cfg, t, sunScratch, pos)
      satPosition(cfg, t + 0.25, sunScratch, posAhead)
      satData.positions[i * 3] = pos[0]
      satData.positions[i * 3 + 1] = pos[1]
      satData.positions[i * 3 + 2] = pos[2]

      vPos.set(pos[0], pos[1], pos[2])
      // nadir frame: Y radial-out, X along-track (wing axis), Z completes
      vY.copy(vPos).normalize()
      vX.set(posAhead[0] - pos[0], posAhead[1] - pos[1], posAhead[2] - pos[2]).normalize()
      vZ.crossVectors(vX, vY).normalize()
      vX.crossVectors(vY, vZ).normalize()
      mBasis.makeBasis(vX, vY, vZ).setPosition(vPos)

      // bus
      mLocal.compose(V_TMP.set(0, 0, 0), IDENTITY_Q, vScale.setScalar(S))
      mOut.multiplyMatrices(mBasis, mLocal)
      busMesh.setMatrixAt(i, mOut)
      // radiator on the anti-nadir face
      mLocal.compose(V_TMP.set(0, (BUS.y / 2 + RADIATOR.y / 2) * S, 0), IDENTITY_Q, vScale.setScalar(S))
      mOut.multiplyMatrices(mBasis, mLocal)
      radMesh.setMatrixAt(i, mOut)
      // pick target
      mLocal.compose(V_TMP.set(0, 0, 0), IDENTITY_Q, vScale.setScalar(pickR / 0.1))
      mOut.multiplyMatrices(mBasis, mLocal)
      pickMesh.setMatrixAt(i, mOut)

      // sun-tracking roll about the wing (X) axis: panel normal starts at +Y
      const sy = vSun.dot(vY)
      const sz = vSun.dot(vZ)
      qRoll.setFromAxisAngle(AXIS_X, Math.atan2(sz, sy))

      for (let side = 0; side < 2; side++) {
        const dir = side === 0 ? 1 : -1
        // strut
        qTip.copy(qRoll).multiply(Q_ROT_Z90)
        mLocal.compose(
          V_TMP.set(dir * (BUS.x / 2 + WING_GAP / 2) * S, 0, 0),
          qTip,
          vScale.set(S, S, S),
        )
        mOut.multiplyMatrices(mBasis, mLocal)
        strutMesh.setMatrixAt(i * 2 + side, mOut)
        // wing
        mLocal.compose(
          V_TMP.set(dir * (BUS.x / 2 + WING_GAP + WING.len / 2) * S, 0, 0),
          qRoll,
          vScale.set(S, S, S),
        )
        mOut.multiplyMatrices(mBasis, mLocal)
        wingMesh.setMatrixAt(i * 2 + side, mOut)
      }
    }
    busMesh.instanceMatrix.needsUpdate = true
    radMesh.instanceMatrix.needsUpdate = true
    wingMesh.instanceMatrix.needsUpdate = true
    strutMesh.instanceMatrix.needsUpdate = true
    pickMesh.instanceMatrix.needsUpdate = true
    // the net-glint layer shares satData.positions directly
    if (dots.current) {
      const attr = dots.current.geometry.attributes.position as THREE.BufferAttribute | undefined
      if (attr) attr.needsUpdate = true
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.instanceId === undefined) return
    setFocus({ kind: 'satellite', id: getFleet()[e.instanceId].id })
  }

  /** focused satellite's full orbit ring (its personal pattern) */
  const focusRing = useMemo(() => {
    if (focus.kind !== 'satellite') return null
    const cfg = getFleet()[satIndexOf(focus.id)]
    if (!cfg) return null
    const sd: Vec3 = [0, 0, 0]
    sunDirection(simClock.t, sd)
    const pts: [number, number, number][] = []
    const probe = { ...cfg }
    for (let k = 0; k <= 128; k++) {
      // sweep the full anomaly at the current instant
      probe.phase = cfg.phase + (k / 128) * Math.PI * 2 - simClock.t * cfg.angVel
      const p: Vec3 = [0, 0, 0]
      satPosition(probe, simClock.t, sd, p)
      pts.push([p[0], p[1], p[2]])
    }
    return pts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, fleetVersion])

  return (
    <group key={`${fleetVersion}-${satCount}`}>
      {/* net-glint layer: one additive point per data center so the whole
          constellation reads from any distance even at tiny hardware scale */}
      <points ref={dots} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[satData.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={2.6}
          sizeAttenuation={false}
          color="#bcd8ff"
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* invisible generous pick targets */}
      <instancedMesh
        ref={picks}
        args={[undefined, undefined, satCount]}
        frustumCulled={false}
        visible={false}
        onClick={handleClick}
        onPointerMove={(e) => {
          e.stopPropagation()
          if (e.instanceId !== undefined) {
            setHoveredSat(getFleet()[e.instanceId].id)
            document.body.style.cursor = 'pointer'
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

      {/* bus — MLI gold foil */}
      <instancedMesh ref={buses} args={[undefined, undefined, satCount]} frustumCulled={false} raycast={() => null}>
        <boxGeometry args={[BUS.x, BUS.y, BUS.z]} />
        <meshStandardMaterial map={mliTex} color="#c9a86a" metalness={0.75} roughness={0.45} />
      </instancedMesh>

      {/* radiator plate */}
      <instancedMesh ref={radiators} args={[undefined, undefined, satCount]} frustumCulled={false} raycast={() => null}>
        <boxGeometry args={[RADIATOR.x, RADIATOR.y, RADIATOR.z]} />
        <meshStandardMaterial color="#e8edf4" metalness={0.3} roughness={0.35} />
      </instancedMesh>

      {/* solar wings — large, three-segment, visible cell grid */}
      <instancedMesh ref={wings} args={[undefined, undefined, satCount * 2]} frustumCulled={false} raycast={() => null}>
        <boxGeometry args={[WING.len, WING.thick, WING.width]} />
        <meshStandardMaterial map={cellTex} metalness={0.45} roughness={0.3} emissive="#12305e" emissiveIntensity={0.22} emissiveMap={cellTex} />
      </instancedMesh>

      {/* struts */}
      <instancedMesh ref={struts} args={[undefined, undefined, satCount * 2]} frustumCulled={false} raycast={() => null}>
        <cylinderGeometry args={[0.006, 0.006, WING_GAP + 0.02, 6]} />
        <meshStandardMaterial color="#5b6b80" metalness={0.9} roughness={0.4} />
      </instancedMesh>

      {/* focused satellite's own orbital pattern */}
      {showOrbits && focusRing && (
        <Line points={focusRing} color="#2c4a6e" transparent opacity={0.35} lineWidth={1} />
      )}
    </group>
  )
}

const IDENTITY_Q = new THREE.Quaternion()
const Q_ROT_Z90 = new THREE.Quaternion().setFromAxisAngle(AXIS_Z, Math.PI / 2)
