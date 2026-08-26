import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { simClock, useSimStore } from '../store/simStore'
import { useFocusStore } from '../store/focusStore'
import { QUALITY_PRESETS, useSettingsStore } from '../store/settingsStore'
import { usePerfStore } from '../store/perfStore'
import { clampDprToTextureLimit, webglCaps } from '../utils/webgl'
import { diagLog } from '../utils/diag'
import { CameraRig } from './CameraRig'
import { Starfield } from './Starfield'
import { Constellations } from './Constellations'
import { Sun } from './Sun'
import { Earth } from './Earth'
import { Moon } from './Moon'
import { SatelliteNet } from './SatelliteNet'
import { SatelliteDetail } from './SatelliteDetail'

/** Advances simTime before anything else reads it (priority -10). */
function ClockDriver() {
  useFrame((_, delta) => {
    const { paused, timeScale } = useSimStore.getState()
    if (!paused) simClock.t += Math.min(delta, 0.1) * timeScale
  }, -10)
  return null
}

function FpsProbe() {
  const setFps = usePerfStore((s) => s.setFps)
  const frames = useRef(0)
  const last = useRef(performance.now())
  const logged = useRef(false)
  useFrame(({ gl, scene }) => {
    if (!logged.current) {
      logged.current = true
      diagLog(`first frame rendered · sceneChildren=${scene.children.length} · drawingBuffer=${gl.getContext().drawingBufferWidth}x${gl.getContext().drawingBufferHeight}`)
    }
    frames.current++
    const now = performance.now()
    if (now - last.current >= 600) {
      setFps(Math.round((frames.current * 1000) / (now - last.current)))
      frames.current = 0
      last.current = now
    }
  })
  return null
}

export function SolsukScene() {
  const quality = useSettingsStore((s) => s.quality)
  const preset = QUALITY_PRESETS[quality]
  const dprOverride = new URLSearchParams(window.location.search).get('dpr')

  return (
    <Canvas
      dpr={dprOverride ? parseFloat(dprOverride) : clampDprToTextureLimit(preset.dpr)}
      camera={{ position: [9.5, 4.6, 13.5], fov: 45, near: 0.1, far: 1200 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        diagLog(`three renderer created · webgl2=${gl.capabilities.isWebGL2} · composer=${webglCaps().floatRT ? 'on' : 'off'}`)
      }}
      onPointerMissed={() => {
        const { focus, escToParent } = useFocusStore.getState()
        if (focus.kind !== 'overview') escToParent()
      }}
    >
      <color attach="background" args={['#030509']} />
      <ClockDriver />
      <CameraRig />
      <FpsProbe />

      <Starfield />
      <Constellations />
      <Sun />
      <Suspense fallback={null}>
        <Earth />
        <Moon />
      </Suspense>
      <SatelliteNet />
      <SatelliteDetail />

      {webglCaps().floatRT && (
        <EffectComposer>
          <Bloom mipmapBlur intensity={preset.bloomIntensity} luminanceThreshold={0.55} luminanceSmoothing={0.2} radius={0.8} />
          <Vignette eskil={false} offset={0.16} darkness={0.78} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
