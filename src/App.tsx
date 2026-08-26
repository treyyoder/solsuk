import { useCallback, useEffect, useState } from 'react'
import { SolsukScene } from './scenes/SolsukScene'
import { TopBar } from './components/TopBar'
import { FleetList } from './components/FleetList'
import { RightInspector } from './components/RightInspector'
import { BottomBar } from './components/BottomBar'
import { LandingOverlay } from './components/LandingOverlay'
import { WebGL2Banner } from './components/WebGL2Banner'
import { SceneErrorBoundary } from './components/SceneErrorBoundary'
import { DiagOverlay } from './components/DiagOverlay'
import { installDiag, diagLog } from './utils/diag'
import { supportsWebGL2, webglCaps } from './utils/webgl'
import { useFocusStore } from './store/focusStore'
import { useSettingsStore } from './store/settingsStore'

installDiag()

function PanelToggle({ side, open, onClick }: { side: 'left' | 'right'; open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="btn-ghost pointer-events-auto flex h-10 w-5 items-center justify-center self-center rounded-md text-[10px] text-fg-dim"
      title={open ? 'Collapse panel' : 'Expand panel'}
    >
      {side === 'left' ? (open ? '‹' : '›') : open ? '›' : '‹'}
    </button>
  )
}

export default function App() {
  const landing = useFocusStore((s) => s.landing)
  const escToParent = useFocusStore((s) => s.escToParent)
  const { leftOpen, rightOpen, toggle } = useSettingsStore()

  const [webgl2, setWebgl2] = useState(() => supportsWebGL2())
  const recheckWebgl2 = useCallback(() => {
    const ok = supportsWebGL2()
    if (ok) setWebgl2(true)
    return ok
  }, [])

  const dismissLanding = useFocusStore((s) => s.dismissLanding)
  useEffect(() => {
    if (!webgl2 && landing) dismissLanding()
  }, [webgl2, landing, dismissLanding])

  useEffect(() => {
    if (webgl2 && !webglCaps().floatRT) useSettingsStore.getState().set({ quality: 'low' })
  }, [webgl2])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') escToParent()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [escToParent])

  return (
    <div className="relative h-full w-full overflow-hidden bg-void">
      <div className="absolute inset-0">
        {webgl2 ? (
          <SceneErrorBoundary
            fallback={(error) => {
              diagLog(`SceneErrorBoundary: ${error}`)
              return <WebGL2Banner onRecheck={recheckWebgl2} errorDetail={error} />
            }}
          >
            <SolsukScene />
          </SceneErrorBoundary>
        ) : (
          <WebGL2Banner onRecheck={recheckWebgl2} />
        )}
      </div>

      {webgl2 && !webglCaps().floatRT && (
        <div className="glass pointer-events-none absolute bottom-3 left-3 z-20 rounded-md px-3 py-1.5 text-[10px] tracking-wider text-warn">
          REDUCED EFFECTS · WebGL float render targets unavailable — bloom disabled
        </div>
      )}

      {landing ? (
        <LandingOverlay />
      ) : (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col gap-3 p-3">
          <TopBar />
          <div className="flex min-h-0 flex-1 gap-2">
            {leftOpen && <FleetList />}
            <PanelToggle side="left" open={leftOpen} onClick={() => toggle('leftOpen')} />
            <div className="min-w-0 flex-1" />
            <PanelToggle side="right" open={rightOpen} onClick={() => toggle('rightOpen')} />
            {rightOpen && <RightInspector />}
          </div>
          <BottomBar />
        </div>
      )}

      <DiagOverlay />
    </div>
  )
}
