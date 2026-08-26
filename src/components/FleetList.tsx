import { memo, useState } from 'react'
import { getFleet, useSimStore } from '../store/simStore'
import { useFocusStore } from '../store/focusStore'
import { useSettingsStore } from '../store/settingsStore'
import { MAX_SAT_COUNT } from '../simulation/constants'
import { Section, ToggleRow } from './ui'

const PAGE = 128

/** Static row — no stats subscription, so 1024+ rows don't re-render at 10 Hz. */
const FleetRow = memo(function FleetRow({
  id,
  name,
  selected,
  onClick,
}: {
  id: string
  name: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-baseline gap-2 rounded px-1.5 py-[2px] text-left transition-colors hover:bg-white/5 ${
        selected ? 'bg-orbit/15' : ''
      }`}
    >
      <span className={`mono w-[70px] shrink-0 text-[10px] ${selected ? 'text-orbit' : 'text-fg-dim'}`}>{id}</span>
      <span className="truncate text-[9px] text-fg-dim/70">{name}</span>
    </button>
  )
})

export function FleetList() {
  const satCount = useSimStore((s) => s.satCount)
  const setSatCount = useSimStore((s) => s.setSatCount)
  const addSatellites = useSimStore((s) => s.addSatellites)
  useSimStore((s) => s.fleetVersion) // re-render the list on regeneration
  const focus = useFocusStore((s) => s.focus)
  const setFocus = useFocusStore((s) => s.setFocus)
  const settings = useSettingsStore()

  const [page, setPage] = useState(0)
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  const selectedId = focus.kind === 'satellite' ? focus.id : null
  const fleet = getFleet()
  const pages = Math.ceil(fleet.length / PAGE)
  const visible = fleet.slice(page * PAGE, (page + 1) * PAGE)

  return (
    <div className="glass pointer-events-auto flex h-full w-60 flex-col overflow-y-auto rounded-xl p-3">
      <Section title="Constellation">
        <div className="mb-2 flex items-center justify-between">
          <span className="mono text-lg text-orbit">{satCount.toLocaleString()}</span>
          <button
            onClick={() => {
              const id = addSatellites(1)
              setFocus({ kind: 'satellite', id })
            }}
            className="btn-ghost rounded-md px-2.5 py-1.5 text-[10px] tracking-wider text-orbit"
            title="Launch one more data center into the next free orbit slot"
          >
            + LAUNCH
          </button>
        </div>
        <div className="mb-1 flex items-center gap-2">
          <span className="mono w-14 shrink-0 text-[9px] text-fg-dim">FLEET</span>
          <input
            type="range"
            min={64}
            max={MAX_SAT_COUNT}
            step={64}
            value={pendingCount ?? satCount}
            onChange={(e) => setPendingCount(parseInt(e.target.value))}
            onMouseUp={() => {
              if (pendingCount !== null) {
                setSatCount(pendingCount)
                setPendingCount(null)
                setPage(0)
              }
            }}
            onTouchEnd={() => {
              if (pendingCount !== null) {
                setSatCount(pendingCount)
                setPendingCount(null)
                setPage(0)
              }
            }}
            className="flex-1"
          />
          <span className="mono w-10 shrink-0 text-right text-[9px] text-fg">{pendingCount ?? satCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="mono w-14 shrink-0 text-[9px] text-fg-dim">SIZE</span>
          <input
            type="range"
            min={0.02}
            max={1}
            step={0.02}
            value={settings.satScale}
            onChange={(e) => settings.set({ satScale: parseFloat(e.target.value) })}
            className="flex-1"
          />
          <span className="mono w-10 shrink-0 text-right text-[9px] text-fg">{settings.satScale.toFixed(2)}×</span>
        </div>
      </Section>

      <Section
        title="Fleet"
        right={
          pages > 1 ? (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(0, page - 1))} className="btn-ghost h-5 w-5 rounded text-[10px]">
                ‹
              </button>
              <span className="mono text-[9px] text-fg-dim">
                {page + 1}/{pages}
              </span>
              <button onClick={() => setPage(Math.min(pages - 1, page + 1))} className="btn-ghost h-5 w-5 rounded text-[10px]">
                ›
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col">
          {visible.map((cfg) => (
            <FleetRow
              key={cfg.id}
              id={cfg.id}
              name={cfg.name}
              selected={selectedId === cfg.id}
              onClick={() => setFocus({ kind: 'satellite', id: cfg.id })}
            />
          ))}
        </div>
      </Section>

      <Section title="Display">
        <ToggleRow label="Focused orbit" value={settings.orbits} onChange={() => settings.toggle('orbits')} />
        <ToggleRow label="Constellations" value={settings.constellationLines} onChange={() => settings.toggle('constellationLines')} />
        <ToggleRow label="Auto-rotate" value={settings.autoRotate} onChange={() => settings.toggle('autoRotate')} />
      </Section>
    </div>
  )
}
