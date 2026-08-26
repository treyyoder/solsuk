import type { ReactNode } from 'react'

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="hud-label">{title}</div>
        {right}
      </div>
      {children}
    </div>
  )
}

export function StatRow({ label, value, accent }: { label: string; value: string; accent?: 'orbit' | 'sol' | 'ion' | 'warn' | 'alert' }) {
  const color =
    accent === 'sol'
      ? 'text-sol'
      : accent === 'ion'
        ? 'text-ion'
        : accent === 'warn'
          ? 'text-warn'
          : accent === 'alert'
            ? 'text-alert'
            : accent === 'orbit'
              ? 'text-orbit'
              : 'text-fg'
  return (
    <div className="flex items-baseline justify-between py-0.5 text-[11px]">
      <span className="text-fg-dim">{label}</span>
      <span className={`mono ${color}`}>{value}</span>
    </div>
  )
}

export function Bar({ value, color = 'var(--color-orbit)', warnBelow }: { value: number; color?: string; warnBelow?: number }) {
  const pct = Math.max(0, Math.min(100, value * 100))
  const barColor = warnBelow !== undefined && pct < warnBelow ? 'var(--color-alert)' : color
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-black/40">
      <div className="prob-fill h-full rounded" style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 8px ${barColor}55` }} />
    </div>
  )
}

export function Badge({ children, tone }: { children: ReactNode; tone: 'sol' | 'orbit' | 'ion' | 'alert' | 'dim' }) {
  const cls =
    tone === 'sol'
      ? 'border-sol/50 text-sol bg-sol/10'
      : tone === 'orbit'
        ? 'border-orbit/50 text-orbit bg-orbit/10'
        : tone === 'ion'
          ? 'border-ion/50 text-ion bg-ion/10'
          : tone === 'alert'
            ? 'border-alert/50 text-alert bg-alert/10'
            : 'border-edge text-fg-dim bg-black/20'
  return <span className={`mono rounded border px-1.5 py-0.5 text-[9px] tracking-wider ${cls}`}>{children}</span>
}

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs text-fg-dim transition-colors hover:bg-white/5 hover:text-fg"
    >
      <span>{label}</span>
      <span className={`relative inline-block h-3.5 w-7 rounded-full transition-colors ${value ? 'bg-orbit/40' : 'bg-edge'}`}>
        <span
          className={`absolute top-0.5 h-2.5 w-2.5 rounded-full transition-all ${
            value ? 'left-4 bg-orbit shadow-[0_0_8px_rgba(77,166,255,0.8)]' : 'left-0.5 bg-fg-dim'
          }`}
        />
      </span>
    </button>
  )
}
