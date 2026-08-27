import { memo, useState } from 'react'
import { getFleetByClass, MAX_CROSSLINKS, useSimStore } from '../store/simStore'
import { useFocusStore } from '../store/focusStore'
import { useSettingsStore } from '../store/settingsStore'
import { CLASS_META, FACILITY_CLASSES, fmtCount, fmtPowerMW, type FacilityClass } from '../simulation/epochModel'
import { Section, ToggleRow } from './ui'

const PAGE = 96

/** Static row — no live-stat subscription, so tens of thousands of rows never re-render at 10 Hz. */
const FleetRow = memo(function FleetRow({
  id,
  name,
  powerMW,
  color,
  selected,
  onClick,
}: {
  id: string
  name: string
  powerMW: number
  color: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-baseline gap-1.5 rounded px-1.5 py-[2px] text-left transition-colors hover:bg-white/5 ${
        selected ? 'bg-orbit/15' : ''
      }`}
    >
      <span className="inline-block h-1.5 w-1.5 shrink-0 self-center rounded-full" style={{ background: color }} />
      <span className={`mono w-[74px] shrink-0 text-[10px] ${selected ? 'text-orbit' : 'text-fg-dim'}`}>{id}</span>
      <span className="min-w-0 flex-1 truncate text-[9px] text-fg-dim/70">{name}</span>
      <span className="mono shrink-0 text-[9px] text-fg-dim">{fmtPowerMW(powerMW)}</span>
    </button>
  )
})

function AssumptionSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <span className="mono w-[72px] shrink-0 text-[8px] uppercase tracking-wider text-fg-dim">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="min-w-0 flex-1" />
      <span className="mono w-11 shrink-0 text-right text-[9px] text-fg">{display}</span>
    </div>
  )
}

export function FleetList() {
  const epoch = useSimStore((s) => s.epoch)
  const config = useSimStore((s) => s.config)
  const setConfig = useSimStore((s) => s.setConfig)
  const launchFacility = useSimStore((s) => s.launchFacility)
  useSimStore((s) => s.fleetVersion)
  const focus = useFocusStore((s) => s.focus)
  const setFocus = useFocusStore((s) => s.setFocus)
  const settings = useSettingsStore()

  const [page, setPage] = useState(0)
  const [classFilter, setClassFilter] = useState<FacilityClass | 'all'>('all')

  const selectedId = focus.kind === 'satellite' ? focus.id : null
  const byClass = getFleetByClass()
  const visible = classFilter === 'all' ? FACILITY_CLASSES.flatMap((c) => byClass[c]) : byClass[classFilter]
  const pages = Math.max(1, Math.ceil(visible.length / PAGE))
  const clampedPage = Math.min(page, pages - 1)
  const rows = visible.slice(clampedPage * PAGE, (clampedPage + 1) * PAGE)

  return (
    <div className="glass pointer-events-auto flex h-full w-64 flex-col overflow-y-auto rounded-xl p-3">
      <Section title="Constellation">
        <div className="mb-2 flex items-center justify-between">
          <span className="mono text-lg text-orbit">{fmtCount(epoch.totalCount)}</span>
          <button
            onClick={() => {
              const id = launchFacility()
              if (id) setFocus({ kind: 'satellite', id })
            }}
            className="btn-ghost rounded-md px-2.5 py-1.5 text-[10px] tracking-wider text-orbit"
            title="Launch one more facility of the era's flagship class, on top of the growth model"
          >
            + LAUNCH
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="mono w-[72px] shrink-0 text-[8px] uppercase tracking-wider text-fg-dim">Size</span>
          <input
            type="range"
            min={0.02}
            max={0.6}
            step={0.01}
            value={settings.satScale}
            onChange={(e) => settings.set({ satScale: parseFloat(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="mono w-11 shrink-0 text-right text-[9px] text-fg">{settings.satScale.toFixed(2)}×</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2" title="How many of its closest peers each data center links to">
          <span className="mono w-[72px] shrink-0 text-[8px] uppercase tracking-wider text-fg-dim">Links / DC</span>
          <input
            type="range"
            min={1}
            max={MAX_CROSSLINKS}
            step={1}
            value={settings.maxCrosslinks}
            onChange={(e) => settings.set({ maxCrosslinks: parseInt(e.target.value, 10) })}
            className="min-w-0 flex-1"
          />
          <span className="mono w-11 shrink-0 text-right text-[9px] text-fg">{settings.maxCrosslinks}</span>
        </div>
        <div className="mt-1.5">
          <ToggleRow label="ODC network" value={settings.odcNetwork} onChange={() => settings.toggle('odcNetwork')} />
          <ToggleRow label="Earth links" value={settings.earthLinks} onChange={() => settings.toggle('earthLinks')} />
        </div>
        <div
          className="mt-1.5 flex items-center gap-2"
          title="Constellation shape — DONUT: sun-riding shells all around Earth; CONE: a conical swarm aimed at the sun (its axis stays clear, so the sun is never blocked)"
        >
          <span className="mono w-[72px] shrink-0 text-[8px] uppercase tracking-wider text-fg-dim">Pattern</span>
          <div className="flex gap-1">
            {(['donut', 'cone'] as const).map((p) => (
              <button
                key={p}
                onClick={() => settings.set({ orbitPattern: p })}
                className={`btn-ghost rounded px-2 py-0.5 text-[8px] uppercase ${settings.orbitPattern === p ? 'active' : ''}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Model assumptions">
        <AssumptionSlider
          label="Growth"
          value={Math.log2(config.growthMultiplier)}
          min={-2}
          max={2}
          step={0.25}
          display={`${config.growthMultiplier.toFixed(2)}×`}
          onChange={(v) => setConfig({ growthMultiplier: Math.pow(2, v) })}
        />
        <AssumptionSlider
          label="Compute eff"
          value={Math.log2(config.computeEffMultiplier)}
          min={-2}
          max={2}
          step={0.25}
          display={`${config.computeEffMultiplier.toFixed(2)}×`}
          onChange={(v) => setConfig({ computeEffMultiplier: Math.pow(2, v) })}
        />
        <AssumptionSlider
          label="Solar cells"
          value={config.solarEffBonusPct}
          min={-5}
          max={12}
          step={0.5}
          display={`${config.solarEffBonusPct >= 0 ? '+' : ''}${config.solarEffBonusPct.toFixed(1)}pt`}
          onChange={(v) => setConfig({ solarEffBonusPct: v })}
        />
        <AssumptionSlider
          label="Radiator T"
          value={config.radiatorTempK}
          min={290}
          max={420}
          step={5}
          display={`${config.radiatorTempK} K`}
          onChange={(v) => setConfig({ radiatorTempK: v })}
        />
        <AssumptionSlider
          label="System eff"
          value={config.systemEff}
          min={0.5}
          max={0.92}
          step={0.02}
          display={`${(config.systemEff * 100).toFixed(0)}%`}
          onChange={(v) => setConfig({ systemEff: v })}
        />
      </Section>

      <Section
        title="Fleet"
        right={
          pages > 1 ? (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(0, clampedPage - 1))} className="btn-ghost h-5 w-5 rounded text-[10px]">
                ‹
              </button>
              <span className="mono text-[9px] text-fg-dim">
                {clampedPage + 1}/{pages}
              </span>
              <button onClick={() => setPage(Math.min(pages - 1, clampedPage + 1))} className="btn-ghost h-5 w-5 rounded text-[10px]">
                ›
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="mb-1.5 flex flex-wrap gap-1">
          <button
            onClick={() => {
              setClassFilter('all')
              setPage(0)
            }}
            className={`btn-ghost rounded px-1.5 py-0.5 text-[8px] uppercase ${classFilter === 'all' ? 'active' : ''}`}
          >
            all
          </button>
          {FACILITY_CLASSES.map((cls) =>
            epoch.counts[cls] > 0 ? (
              <button
                key={cls}
                onClick={() => {
                  setClassFilter(cls)
                  setPage(0)
                }}
                className={`btn-ghost rounded px-1.5 py-0.5 text-[8px] uppercase ${classFilter === cls ? 'active' : ''}`}
                title={CLASS_META[cls].label}
              >
                {CLASS_META[cls].short}
              </button>
            ) : null,
          )}
        </div>
        <div className="flex flex-col">
          {rows.map((cfg) => (
            <FleetRow
              key={cfg.id}
              id={cfg.id}
              name={cfg.name}
              powerMW={cfg.powerMW}
              color={CLASS_META[cfg.cls].color}
              selected={selectedId === cfg.id}
              onClick={() => setFocus({ kind: 'satellite', id: cfg.id })}
            />
          ))}
          {rows.length === 0 && <div className="py-2 text-center text-[10px] text-fg-dim">no facilities on orbit yet</div>}
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
