import { useEffect, useRef } from 'react'
import { CameraControls } from '@react-three/drei'
import type CameraControlsImpl from 'camera-controls'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useFocusStore } from '../store/focusStore'
import { useSettingsStore } from '../store/settingsStore'
import { satConfigOf, satData, satIndexOf, simClock } from '../store/simStore'
import { CLASS_SPAN } from './SatelliteNet'
import { moonWorldPos } from './Moon'
import { satPosition, sunDirection, sunPosition } from '../simulation/orbits'
import { diagEnabled, diagLog } from '../utils/diag'
import type { FocusTarget, Vec3 } from '../simulation/types'

export const cameraBus: { controls: CameraControlsImpl | null } = { controls: null }

diagLog('camera rig v2 (feed-forward chase) loaded')

const sunScratch: Vec3 = [0, 0, 0]
const sunDirScratch: Vec3 = [0, 0, 0]
const posScratch: Vec3 = [0, 0, 0]
const vCam = new THREE.Vector3()

const OVERVIEW_DIST = 17
/** angular offset of the sun from screen-center in the initial framing — kept
 * inside the ~22.5°(V)/~36°(H) half-FOV at 45° fov so it's clearly visible,
 * not clipped, and not dead-center either */
const OVERVIEW_YAW = (14 * Math.PI) / 180
const OVERVIEW_PITCH = (14 * Math.PI) / 180

/**
 * Initial "overview" framing: camera sits on Earth's dark side (opposite the
 * sun at sim start, t=0), looking at Earth from a direction rotated
 * OVERVIEW_YAW/PITCH off the exact sun line. Since the camera's forward
 * vector is what rotated, the sun itself doesn't move — it lands offset
 * from screen-center by exactly that angle. Yawing the gaze toward the
 * sun-line's "right" axis puts the sun to that gaze's LEFT (you turned
 * right, so what was ahead is now on your left); pitching the gaze DOWN
 * puts the sun, at the same height, ABOVE the new gaze — together, upper-left.
 * Derived from the actual sun direction at t=0, not a disconnected literal.
 */
function computeDefaultOverviewPose(): { position: [number, number, number]; target: [number, number, number] } {
  const sunDir0: Vec3 = [0, 0, 0]
  sunDirection(0, sunDir0) // f0: direction toward the sun; has y=0 (ecliptic)
  // right0 = cross(worldUp, f0) — unit length, also y=0, so cross(f0,right0)=worldUp exactly
  const right0: Vec3 = [sunDir0[2], 0, -sunDir0[0]]

  // yaw: rotate f0 toward -right0 within the horizontal plane (puts the sun,
  // which stays put, on the LEFT of the new gaze — verified empirically:
  // +right0 landed it upper-RIGHT instead)
  const cy = Math.cos(OVERVIEW_YAW)
  const sy = Math.sin(OVERVIEW_YAW)
  const hx = sunDir0[0] * cy - right0[0] * sy
  const hz = sunDir0[2] * cy - right0[2] * sy

  // pitch: tilt that horizontal gaze down toward -worldUp
  const cp = Math.cos(OVERVIEW_PITCH)
  const sp = Math.sin(OVERVIEW_PITCH)
  const forward: Vec3 = [hx * cp, -sp, hz * cp]

  return {
    position: [-forward[0] * OVERVIEW_DIST, -forward[1] * OVERVIEW_DIST, -forward[2] * OVERVIEW_DIST],
    target: [0, 0, 0],
  }
}
let DEFAULT_OVERVIEW_POSE = computeDefaultOverviewPose()
// ?view=side — overview from PERPENDICULAR to the sun line, for inspecting
// the constellation's profile (a double cone only shows its X from the side)
if (new URLSearchParams(window.location.search).get('view') === 'side') {
  const sd: Vec3 = [0, 0, 0]
  sunDirection(0, sd)
  DEFAULT_OVERVIEW_POSE = {
    position: [sd[2] * OVERVIEW_DIST, OVERVIEW_DIST * 0.1, -sd[0] * OVERVIEW_DIST],
    target: [0, 0, 0],
  }
}

/** live position of the focused satellite — falls back to direct orbit math before the first frame */
function liveSatPos(id: string, out: Vec3): Vec3 {
  const i = satIndexOf(id) * 3
  out[0] = satData.positions[i]
  out[1] = satData.positions[i + 1]
  out[2] = satData.positions[i + 2]
  if (Math.hypot(out[0], out[1], out[2]) < 0.5) {
    const cfg = satConfigOf(id)
    if (cfg) {
      sunDirection(simClock.t, sunDirScratch)
      satPosition(cfg, simClock.t, sunDirScratch, out)
    }
  }
  return out
}

/** chase offset for a satellite: sunlit-side vantage scaled to the facility's class span */
function satChasePose(id: string): { position: Vec3; target: Vec3 } {
  liveSatPos(id, posScratch)
  const p: Vec3 = [posScratch[0], posScratch[1], posScratch[2]]
  const len = Math.hypot(...p) || 1
  const S = useSettingsStore.getState().satScale
  const span = CLASS_SPAN[satConfigOf(id)?.cls ?? 'pioneer']
  // 2.6× half-span keeps the camera outside even the widest wing sweep
  const dRad = Math.max(S * span * 2.6, 0.18)
  const dSun = Math.max(S * span * 2.2, 0.16)
  sunPosition(simClock.t, sunScratch)
  const sd = Math.hypot(...sunScratch) || 1
  return {
    position: [
      p[0] + (p[0] / len) * dRad + (sunScratch[0] / sd) * dSun,
      p[1] + (p[1] / len) * dRad + (sunScratch[1] / sd) * dSun + dRad * 0.35,
      p[2] + (p[2] / len) * dRad + (sunScratch[2] / sd) * dSun,
    ],
    target: p,
  }
}

function staticPoseFor(focus: FocusTarget): { position: [number, number, number]; target: [number, number, number] } {
  switch (focus.kind) {
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
    default:
      return DEFAULT_OVERVIEW_POSE
  }
}

const noDrift = new URLSearchParams(window.location.search).has('nodrift')

export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null)
  const focus = useFocusStore((s) => s.focus)
  const landing = useFocusStore((s) => s.landing) && !noDrift
  const autoRotate = useSettingsStore((s) => s.autoRotate) && !noDrift

  /** 'approach' = cinematic fly-in toward a moving object; 'chase' = translate with it */
  const mode = useRef<'idle' | 'approach' | 'chase'>('idle')
  const prevTarget = useRef(new THREE.Vector3())
  const diagAccum = useRef(0)

  useEffect(() => {
    cameraBus.controls = ref.current
    if (ref.current) {
      ref.current.smoothTime = 0.6
      ref.current.dollySpeed = 0.7
      ref.current.minDistance = 0.05
      ref.current.maxDistance = 160
    }
    return () => {
      cameraBus.controls = null
    }
  }, [])

  useEffect(() => {
    const c = ref.current
    if (!c) return
    if (focus.kind === 'satellite' || focus.kind === 'moon') {
      mode.current = 'approach'
      prevTarget.current.set(NaN, NaN, NaN) // (re)baseline on the first frame
    } else {
      mode.current = 'idle'
      const pose = staticPoseFor(focus)
      c.smoothTime = 0.55
      void c.setLookAt(...pose.position, ...pose.target, true)
    }
  }, [focus])

  useFrame((_, delta) => {
    const c = ref.current
    if (!c) return
    if (landing || autoRotate) c.azimuthAngle += delta * (landing ? 0.045 : 0.1)

    const f = useFocusStore.getState().focus
    if (f.kind !== 'satellite' && f.kind !== 'moon') return

    if (diagEnabled()) {
      diagAccum.current += delta
      if (diagAccum.current > 1) {
        diagAccum.current = 0
        c.getPosition(vCam)
        const i = f.kind === 'satellite' ? satIndexOf(f.id) * 3 : -1
        const d =
          i >= 0
            ? Math.hypot(vCam.x - satData.positions[i], vCam.y - satData.positions[i + 1], vCam.z - satData.positions[i + 2])
            : vCam.distanceTo(moonWorldPos)
        diagLog(`camera mode=${mode.current} distToTarget=${d.toFixed(3)} pos=${vCam.x.toFixed(2)},${vCam.y.toFixed(2)},${vCam.z.toFixed(2)}`)
      }
    }

    // live target
    let tx: number
    let ty: number
    let tz: number
    if (f.kind === 'satellite') {
      liveSatPos(f.id, posScratch)
      tx = posScratch[0]
      ty = posScratch[1]
      tz = posScratch[2]
    } else {
      tx = moonWorldPos.x
      ty = moonWorldPos.y
      tz = moonWorldPos.z
    }

    if (mode.current === 'approach') {
      // Feed-forward tracking: glide the OFFSET from the target, never the raw
      // position — at 30× time scale the target laps Earth in seconds, and a
      // position-pursuit loop would lag by targetSpeed/k forever.
      c.smoothTime = 0 // internal damping would re-introduce that lag
      const desired =
        f.kind === 'satellite'
          ? satChasePose(f.id)
          : (() => {
              const m = moonWorldPos
              const n = m.clone().normalize()
              const dist = f.baseId ? 1.9 : 2.8
              return {
                position: [m.x - n.x * dist, m.y - n.y * dist + dist * 0.35, m.z - n.z * dist] as Vec3,
                target: [m.x, m.y, m.z] as Vec3,
              }
            })()
      const dox = desired.position[0] - desired.target[0]
      const doy = desired.position[1] - desired.target[1]
      const doz = desired.position[2] - desired.target[2]
      c.getPosition(vCam)
      // measure the offset against the target the camera was PLACED with
      // (last frame's) — otherwise the target's per-frame displacement leaks
      // into the offset and the loop equilibrates at speed/k instead of 0
      if (Number.isNaN(prevTarget.current.x)) prevTarget.current.set(tx, ty, tz)
      let ox = vCam.x - prevTarget.current.x
      let oy = vCam.y - prevTarget.current.y
      let oz = vCam.z - prevTarget.current.z
      prevTarget.current.set(tx, ty, tz)
      const k = 1 - Math.exp(-3.2 * delta)
      ox += (dox - ox) * k
      oy += (doy - oy) * k
      oz += (doz - oz) * k
      void c.setLookAt(tx + ox, ty + oy, tz + oz, tx, ty, tz, false)
      const offErr = Math.hypot(dox - ox, doy - oy, doz - oz)
      if (diagEnabled() && diagAccum.current === 0) {
        diagLog(
          `  off=${ox.toFixed(2)},${oy.toFixed(2)},${oz.toFixed(2)} desiredOff=${dox.toFixed(2)},${doy.toFixed(2)},${doz.toFixed(2)} offErr=${offErr.toFixed(3)} k=${(1 - Math.exp(-3.2 * delta)).toFixed(4)}`,
        )
      }
      // the desired vantage itself rotates with the orbit, so the loop carries a
      // small steady lag — accept arrival once we're inside that envelope
      const arriveEps = f.kind === 'satellite' ? Math.max(useSettingsStore.getState().satScale * 2, 0.2) : 0.3
      if (offErr < arriveEps) {
        mode.current = 'chase'
        prevTarget.current.set(tx, ty, tz)
      }
    } else if (mode.current === 'chase') {
      // translate camera by the target's motion — user keeps full orbit control around it
      c.smoothTime = 0
      const dx = tx - prevTarget.current.x
      const dy = ty - prevTarget.current.y
      const dz = tz - prevTarget.current.z
      prevTarget.current.set(tx, ty, tz)
      c.getPosition(vCam)
      void c.setLookAt(vCam.x + dx, vCam.y + dy, vCam.z + dz, tx, ty, tz, false)
    }
  }, -1)

  return <CameraControls ref={ref} makeDefault />
}
