import { useEffect, useRef } from 'react'
import { CameraControls } from '@react-three/drei'
import type CameraControlsImpl from 'camera-controls'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useFocusStore } from '../store/focusStore'
import { useSettingsStore } from '../store/settingsStore'
import { satIndexOf, satPositions, simClock } from '../store/simStore'
import { moonWorldPos } from './Moon'
import { sunPosition } from '../simulation/orbits'
import type { FocusTarget, Vec3 } from '../simulation/types'

export const cameraBus: { controls: CameraControlsImpl | null } = { controls: null }

const sunScratch: Vec3 = [0, 0, 0]

function poseFor(focus: FocusTarget): { position: [number, number, number]; target: [number, number, number] } {
  switch (focus.kind) {
    case 'overview':
      return { position: [9.5, 4.6, 13.5], target: [0, 0, 0] }
    case 'earth':
      return { position: [1.8, 2.2, 7.2], target: [0, 0, 0] }
    case 'sun': {
      sunPosition(simClock.t, sunScratch)
      const d = Math.hypot(...sunScratch)
      const n = sunScratch.map((v) => v / d) as Vec3
      return {
        position: [sunScratch[0] - n[0] * 42, sunScratch[1] - n[1] * 42 + 7, sunScratch[2] - n[2] * 42],
        target: [sunScratch[0], sunScratch[1], sunScratch[2]],
      }
    }
    case 'satellite': {
      const i = satIndexOf(focus.id) * 3
      const p: Vec3 = [satPositions[i], satPositions[i + 1], satPositions[i + 2]]
      const len = Math.hypot(...p) || 1
      const n = p.map((v) => v / len) as Vec3
      // approach from the sunlit side so the hardware reads instead of silhouetting
      sunPosition(simClock.t, sunScratch)
      const sd = Math.hypot(...sunScratch) || 1
      return {
        position: [
          p[0] + n[0] * 0.65 + (sunScratch[0] / sd) * 0.6,
          p[1] + n[1] * 0.65 + (sunScratch[1] / sd) * 0.6 + 0.22,
          p[2] + n[2] * 0.65 + (sunScratch[2] / sd) * 0.6,
        ],
        target: [p[0], p[1], p[2]],
      }
    }
    case 'moon': {
      const m = moonWorldPos
      const toEarth = m.clone().normalize()
      const dist = focus.baseId ? 1.9 : 2.8
      return {
        position: [m.x - toEarth.x * dist, m.y - toEarth.y * dist + dist * 0.35, m.z - toEarth.z * dist],
        target: [m.x, m.y, m.z],
      }
    }
  }
}

export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null)
  const focus = useFocusStore((s) => s.focus)
  const landing = useFocusStore((s) => s.landing)
  const autoRotate = useSettingsStore((s) => s.autoRotate)

  useEffect(() => {
    cameraBus.controls = ref.current
    if (ref.current) {
      ref.current.smoothTime = 0.6
      ref.current.dollySpeed = 0.7
      ref.current.minDistance = 0.4
      ref.current.maxDistance = 160
    }
    return () => {
      cameraBus.controls = null
    }
  }, [])

  // fly to the new focus target when it changes
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const pose = poseFor(focus)
    c.smoothTime = 0.55
    void c.setLookAt(...pose.position, ...pose.target, true)
  }, [focus])

  // follow mode: keep the orbit center glued to the moving object; camera-controls
  // preserves the user's spherical offset, so free rotation still works while tracking
  useFrame((_, delta) => {
    const c = ref.current
    if (!c) return
    if (landing || autoRotate) c.azimuthAngle += delta * (landing ? 0.045 : 0.1)
    const f = useFocusStore.getState().focus
    if (f.kind === 'satellite') {
      const i = satIndexOf(f.id) * 3
      void c.setTarget(satPositions[i], satPositions[i + 1], satPositions[i + 2], false)
    } else if (f.kind === 'moon') {
      void c.setTarget(moonWorldPos.x, moonWorldPos.y, moonWorldPos.z, false)
    }
  }, -1)

  return <CameraControls ref={ref} makeDefault />
}

export { poseFor }
export type { CameraControlsImpl }
export const V3 = THREE.Vector3
