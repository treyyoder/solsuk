import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { NUM_SATS, SHELLS } from '../simulation/constants'
import { orbitPosition, satPosition, sunDirection } from '../simulation/orbits'
import { FLEET, satPositions, simClock, useSimStore } from '../store/simStore'
import { useFocusStore } from '../store/focusStore'
import { useSettingsStore } from '../store/settingsStore'
import type { Vec3 } from '../simulation/types'

const SAT_HUB_R = 0.055
const STRUT_LEN = 0.09
const PANEL_OFFSETS = [0.115, 0.215] // arm segment centers along ±X

// scratch objects — zero per-frame allocation
const pos: Vec3 = [0, 0, 0]
const posAhead: Vec3 = [0, 0, 0]
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
const sunScratch: Vec3 = [0, 0, 0]

const COLOR_SUNLIT = new THREE.Color('#9fd0ff')
const COLOR_ECLIPSE = new THREE.Color('#31435c')
const COLOR_SELECTED = new THREE.Color('#ffd9a0')

/** Per-shell-plane orbit ring points (static). */
function ringPoints(shellIdx: number, raanOffset: number): [number, number, number][] {
  const shell = SHELLS[shellIdx]
  const pts: [number, number, number][] = []
  const p: Vec3 = [0, 0, 0]
  for (let i = 0; i <= 96; i++) {
    orbitPosition(shell.radius, shell.inclination, shell.raan + raanOffset, (i / 96) * Math.PI * 2, p)
    pts.push([p[0], p[1], p[2]])
  }
  return pts
}

export function SatelliteNet() {
  const hubs = useRef<THREE.InstancedMesh>(null)
  const struts = useRef<THREE.InstancedMesh>(null)
  const panels = useRef<THREE.InstancedMesh>(null)
  const picks = useRef<THREE.InstancedMesh>(null)

  const setFocus = useFocusStore((s) => s.setFocus)
  const setHoveredSat = useFocusStore((s) => s.setHoveredSat)
  const showOrbits = useSettingsStore((s) => s.orbits)

  const rings = useMemo(() => {
    const out: [number, number, number][][] = []
    for (let s = 0; s < SHELLS.length; s++) {
      out.push(ringPoints(s, 0))
      out.push(ringPoints(s, Math.PI / 2))
    }
    return out
  }, [])

  // eclipse tinting at 10 Hz via transient subscription — no React re-render
  useEffect(() => {
    const apply = (stats: ReturnType<typeof useSimStore.getState>['stats']) => {
      const hubMesh = hubs.current
      const panelMesh = panels.current
      if (!hubMesh || !panelMesh) return
      const focus = useFocusStore.getState().focus
      const selectedId = focus.kind === 'satellite' ? focus.id : null
      FLEET.forEach((cfg, i) => {
        const st = stats[cfg.id]
        const c = cfg.id === selectedId ? COLOR_SELECTED : st && st.eclipsed ? COLOR_ECLIPSE : COLOR_SUNLIT
        hubMesh.setColorAt(i, c)
        for (let p = 0; p < 4; p++) panelMesh.setColorAt(i * 4 + p, c)
      })
      if (hubMesh.instanceColor) hubMesh.instanceColor.needsUpdate = true
      if (panelMesh.instanceColor) panelMesh.instanceColor.needsUpdate = true
    }
    apply(useSimStore.getState().stats)
    return useSimStore.subscribe((s) => apply(s.stats))
  }, [])

  useFrame(() => {
    const hubMesh = hubs.current
    const strutMesh = struts.current
    const panelMesh = panels.current
    const pickMesh = picks.current
    if (!hubMesh || !strutMesh || !panelMesh || !pickMesh) return

    const t = simClock.t
    sunDirection(t, sunScratch)
    vSun.set(sunScratch[0], sunScratch[1], sunScratch[2])

    for (let i = 0; i < NUM_SATS; i++) {
      const cfg = FLEET[i]
      satPosition(cfg, t, pos)
      satPosition(cfg, t + 0.35, posAhead)
      satPositions[i * 3] = pos[0]
      satPositions[i * 3 + 1] = pos[1]
      satPositions[i * 3 + 2] = pos[2]

      vPos.set(pos[0], pos[1], pos[2])
      // nadir frame: Y radial-out, X along-track, Z completes
      vY.copy(vPos).normalize()
      vX.set(posAhead[0] - pos[0], posAhead[1] - pos[1], posAhead[2] - pos[2]).normalize()
      vZ.crossVectors(vX, vY).normalize()
      vX.crossVectors(vY, vZ).normalize()
      mBasis.makeBasis(vX, vY, vZ).setPosition(vPos)

      // hub + pick target
      hubMesh.setMatrixAt(i, mBasis)
      pickMesh.setMatrixAt(i, mBasis)

      // sun-tracking roll about the arm (X) axis: panel normal starts at +Y
      const sy = vSun.dot(vY)
      const sz = vSun.dot(vZ)
      const roll = Math.atan2(sz, sy)
      qRoll.setFromAxisAngle(AXIS_X, roll)

      for (let side = 0; side < 2; side++) {
        const dir = side === 0 ? 1 : -1
        // strut
        mLocal.makeRotationZ(Math.PI / 2)
        mLocal.setPosition(dir * (SAT_HUB_R + STRUT_LEN / 2 - 0.01), 0, 0)
        mOut.multiplyMatrices(mBasis, mLocal)
        strutMesh.setMatrixAt(i * 2 + side, mOut)
        // panels
        for (let seg = 0; seg < 2; seg++) {
          mLocal.compose(V_TMP.set(dir * PANEL_OFFSETS[seg] + dir * SAT_HUB_R, 0, 0), qRoll, vScale)
          mOut.multiplyMatrices(mBasis, mLocal)
          panelMesh.setMatrixAt(i * 4 + side * 2 + seg, mOut)
        }
      }
    }
    hubMesh.instanceMatrix.needsUpdate = true
    strutMesh.instanceMatrix.needsUpdate = true
    panelMesh.instanceMatrix.needsUpdate = true
    pickMesh.instanceMatrix.needsUpdate = true
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.instanceId === undefined) return
    setFocus({ kind: 'satellite', id: FLEET[e.instanceId].id })
  }

  return (
    <group>
      {/* invisible generous pick targets */}
      <instancedMesh
        ref={picks}
        args={[undefined, undefined, NUM_SATS]}
        frustumCulled={false}
        visible={false}
        onClick={handleClick}
        onPointerMove={(e) => {
          e.stopPropagation()
          if (e.instanceId !== undefined) {
            setHoveredSat(FLEET[e.instanceId].id)
            document.body.style.cursor = 'pointer'
          }
        }}
        onPointerOut={() => {
          setHoveredSat(null)
          document.body.style.cursor = 'default'
        }}
      >
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshBasicMaterial />
      </instancedMesh>

      {/* hubs */}
      <instancedMesh ref={hubs} args={[undefined, undefined, NUM_SATS]} frustumCulled={false} raycast={() => null}>
        <sphereGeometry args={[SAT_HUB_R, 16, 16]} />
        <meshStandardMaterial color="#1b2634" metalness={0.85} roughness={0.35} emissive="#0d1622" emissiveIntensity={0.4} />
      </instancedMesh>

      {/* struts */}
      <instancedMesh ref={struts} args={[undefined, undefined, NUM_SATS * 2]} frustumCulled={false} raycast={() => null}>
        <cylinderGeometry args={[0.006, 0.006, STRUT_LEN, 6]} />
        <meshStandardMaterial color="#5b6b80" metalness={0.9} roughness={0.4} />
      </instancedMesh>

      {/* solar panels */}
      <instancedMesh ref={panels} args={[undefined, undefined, NUM_SATS * 4]} frustumCulled={false} raycast={() => null}>
        <boxGeometry args={[0.09, 0.004, 0.22]} />
        <meshStandardMaterial color="#16325e" metalness={0.6} roughness={0.3} emissive="#1a3f7a" emissiveIntensity={0.35} />
      </instancedMesh>

      {/* orbit rings */}
      {showOrbits &&
        rings.map((pts, i) => (
          <Line key={i} points={pts} color="#2c4a6e" transparent opacity={0.16} lineWidth={1} />
        ))}
    </group>
  )
}

const AXIS_X = new THREE.Vector3(1, 0, 0)
const V_TMP = new THREE.Vector3()
