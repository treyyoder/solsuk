import { useEffect, useState } from 'react'
import { diagEnabled, diagSubscribe } from '../utils/diag'

export function DiagOverlay() {
  const [lines, setLines] = useState<string[]>([])
  useEffect(() => diagSubscribe(setLines), [])
  if (!diagEnabled()) return null
  return (
    <div className="pointer-events-none absolute left-2 top-14 z-50 max-h-[70vh] w-[560px] max-w-[92vw] overflow-hidden rounded-lg border border-warn/40 bg-black/85 p-3">
      <div className="hud-label mb-1 text-warn">DIAGNOSTICS (?diag=1)</div>
      <div className="mono space-y-0.5 text-[10px] leading-tight text-fg">
        {lines.length === 0 ? <div>no events yet…</div> : lines.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  )
}
